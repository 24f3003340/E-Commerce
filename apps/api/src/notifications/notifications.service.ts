import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { config } from '../common/config';
import { EmailService, escapeHtml } from '../common/email.service';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'ORDER_PLACED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PACKED'
  | 'ORDER_SHIPPED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'REFUND_PROCESSED';

/**
 * Stores an in-app notification and fans it out to the delivery channels.
 * - Email: Resend when RESEND_API_KEY is configured, otherwise logged.
 * - Push: placeholder for Firebase Cloud Messaging (mobile apps, phase 4).
 * - SMS / WhatsApp: to be added later depending on provider & DLT compliance.
 * Delivery failures are logged and never break the business operation that triggered them.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
    /** Extra pre-escaped HTML for the email (e.g. an order summary table) */
    emailHtml?: string,
  ) {
    const channels = ['in_app', 'email', 'push'];
    try {
      await this.prisma.notification.create({
        data: { userId, type, title, body, channels, data: data as Prisma.InputJsonValue },
      });
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (user) {
        const orderNumber = typeof data?.orderNumber === 'string' ? data.orderNumber : undefined;
        const html = await this.email.layout(
          title,
          `<p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(body)}</p>${emailHtml ?? ''}`,
          orderNumber ? { label: 'View your order', url: `${config.storefrontUrl}/account/orders/${orderNumber}` } : undefined,
        );
        void this.email.send(user.email, title, html, `Hi ${user.name},\n\n${body}`);
      }
      this.sendPush(userId, title, body);
    } catch (err) {
      this.logger.warn(`Failed to create notification ${type} for ${userId}: ${(err as Error).message}`);
    }
  }

  private sendPush(userId: string, title: string, _body: string) {
    // Integrate Firebase Cloud Messaging here once device tokens are collected by the mobile app.
    this.logger.debug(`[push:dev] user=${userId} title="${title}"`);
  }
}
