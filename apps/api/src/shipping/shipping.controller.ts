import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import { config } from '../common/config';
import { ShippingService } from './shipping.service';

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
    const expected = Buffer.from(config.shippingWebhookToken);
    const given = Buffer.from(token ?? '');
    if (!expected.length || expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    return this.shipping.applyUpdate(dto);
  }
}
