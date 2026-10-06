import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserPrincipal } from '../common/auth.types';
import { config } from '../common/config';
import { CurrentUser } from '../common/decorators';
import { UserAuthGuard } from '../common/guards';
import { isUniqueViolation } from '../common/utils';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayGateway } from './razorpay.gateway';

class VerifyPaymentDto {
  @IsString()
  @MaxLength(60)
  razorpay_order_id: string;

  @IsString()
  @MaxLength(60)
  razorpay_payment_id: string;

  @IsString()
  @MaxLength(200)
  razorpay_signature: string;
}

class MockPaymentDto {
  @IsString()
  providerOrderId: string;

  @IsOptional()
  @IsBoolean()
  success?: boolean;
}

class PaymentFailedDto {
  @IsString()
  @MaxLength(60)
  providerOrderId: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly gateway: RazorpayGateway,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Called by the website after Razorpay Checkout succeeds. The signature is verified with our
   * key secret, and the payment status is re-fetched from Razorpay, so a tampered browser
   * response can never confirm an order. The webhook below confirms it as well (idempotently)
   * in case the browser never comes back.
   */
  @UseGuards(UserAuthGuard)
  @HttpCode(200)
  @Post('razorpay/verify')
  async verify(@CurrentUser() user: UserPrincipal, @Body() dto: VerifyPaymentDto) {
    await this.ownPayment(user.id, dto.razorpay_order_id);
    if (!this.gateway.verifyPaymentSignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature)) {
      throw new BadRequestException('Payment verification failed');
    }
    const payment = await this.gateway.fetchPayment(dto.razorpay_payment_id);
    if (payment.order_id !== dto.razorpay_order_id) throw new BadRequestException('Payment verification failed');
    if (payment.status === 'authorized') {
      // Auto-capture should be enabled in the Razorpay dashboard; the payment.captured webhook
      // will confirm the order as soon as capture completes.
      return { ok: true, pending: true };
    }
    if (payment.status !== 'captured') throw new BadRequestException('Payment not completed');
    const order = await this.orders.markPaid(
      {
        providerOrderId: dto.razorpay_order_id,
        providerPaymentId: dto.razorpay_payment_id,
        amount: payment.amount,
        method: payment.method,
      },
      'payment-callback',
    );
    return { ok: true, orderNumber: order.orderNumber };
  }

  /** Customer closed / failed the payment popup. */
  @UseGuards(UserAuthGuard)
  @HttpCode(200)
  @Post('failed')
  async failed(@CurrentUser() user: UserPrincipal, @Body() dto: PaymentFailedDto) {
    await this.ownPayment(user.id, dto.providerOrderId);
    await this.orders.markPaymentFailed(dto.providerOrderId, dto.reason ?? 'Payment cancelled by customer');
    return { ok: true };
  }

  /** Razorpay webhook (payment.captured / payment.failed). Source of truth for payment status. */
  @HttpCode(200)
  @Post('razorpay/webhook')
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Headers('x-razorpay-event-id') eventId: string | undefined,
  ) {
    if (!req.rawBody || !this.gateway.verifyWebhookSignature(req.rawBody, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }
    const body = req.body as {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; method?: string; error_description?: string } } };
    };
    if (eventId) {
      try {
        await this.prisma.webhookEvent.create({ data: { id: eventId, provider: 'razorpay', type: body.event } });
      } catch (err) {
        if (isUniqueViolation(err)) return { ok: true, duplicate: true };
        throw err;
      }
    }
    const entity = body.payload?.payment?.entity;
    if (!entity?.order_id) return { ok: true };
    try {
      if (body.event === 'payment.captured' || body.event === 'order.paid') {
        await this.orders.markPaid(
          { providerOrderId: entity.order_id, providerPaymentId: entity.id, amount: entity.amount, method: entity.method, raw: body },
          'razorpay-webhook',
        );
      } else if (body.event === 'payment.failed') {
        await this.orders.markPaymentFailed(entity.order_id, entity.error_description ?? 'Payment failed', body);
      }
    } catch (err) {
      if (err instanceof NotFoundException) {
        this.logger.warn(`Webhook for unknown order ${entity.order_id}`);
        return { ok: true };
      }
      throw err;
    }
    return { ok: true };
  }

  /**
   * Development-only stand-in for the Razorpay popup. Disabled automatically when Razorpay keys
   * are configured or in production.
   */
  @UseGuards(UserAuthGuard)
  @HttpCode(200)
  @Post('mock/complete')
  async mockComplete(@CurrentUser() user: UserPrincipal, @Body() dto: MockPaymentDto) {
    if (!this.gateway.isMock || !config.allowMockPayments) throw new ForbiddenException('Mock payments are disabled');
    await this.ownPayment(user.id, dto.providerOrderId);
    if (dto.success === false) {
      await this.orders.markPaymentFailed(dto.providerOrderId, 'Mock payment failed');
      return { ok: false };
    }
    const order = await this.orders.markPaid(
      { providerOrderId: dto.providerOrderId, providerPaymentId: `mock_pay_${Date.now()}`, method: 'mock' },
      'mock-gateway',
    );
    return { ok: true, orderNumber: order.orderNumber };
  }

  private async ownPayment(userId: string, providerOrderId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { providerOrderId }, include: { order: true } });
    if (!payment || payment.order.userId !== userId) throw new NotFoundException('Payment not found');
    return payment;
  }
}
