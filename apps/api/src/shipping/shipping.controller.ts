import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import { config } from '../common/config';
import { mapShiprocketWebhook } from './shiprocket.mapper';
import { ShippingService } from './shipping.service';

function tokenMatches(expectedToken: string, given: string | undefined) {
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(given ?? '');
  return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

class ShippingWebhookDto {
  @IsString()
  @MaxLength(60)
  awb: string;

  @IsString()
  @MaxLength(60)
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

/**
 * Generic webhook for the shipping aggregator. Configure the aggregator to send
 * `x-webhook-token: <SHIPPING_WEBHOOK_TOKEN>`; adapt the DTO mapping to the provider's payload.
 */
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @HttpCode(200)
  @Post('webhook')
  webhook(@Headers('x-webhook-token') token: string | undefined, @Body() dto: ShippingWebhookDto) {
    if (!tokenMatches(config.shippingWebhookToken, token)) throw new UnauthorizedException('Invalid webhook token');
    return this.shipping.applyUpdate(dto);
  }

  /**
   * Shiprocket tracking webhook (Shiprocket → Settings → API → Webhooks). Shiprocket rejects URLs
   * containing "shiprocket", "sr" or "kr", hence the neutral path. It sends the token configured
   * there in the x-api-key header.
   */
  @HttpCode(200)
  @Post('courier-updates')
  courierUpdates(@Headers('x-api-key') token: string | undefined, @Body() body: unknown) {
    if (!tokenMatches(config.shiprocket.webhookToken, token)) throw new UnauthorizedException('Invalid webhook token');
    const update = mapShiprocketWebhook(body);
    // Shiprocket's "test webhook" button sends an empty payload; answer 200 so it can be saved
    if (!update) return { ok: true, ignored: true };
    return this.shipping.applyUpdate(update);
  }
}
