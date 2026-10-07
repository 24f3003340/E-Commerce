import { Injectable, Logger } from '@nestjs/common';
import { config } from './config';
import { SettingsService } from './settings.service';

export const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Transactional email via Resend (https://resend.com). Without RESEND_API_KEY emails are only
 * logged, so development and CI never send real mail. Failures are logged, never thrown.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly settings: SettingsService) {}

  async send(to: string, subject: string, html: string, text: string) {
    if (!config.email.resendApiKey) {
      this.logger.log(`[email:dev] to=${to} subject="${subject}"`);
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.email.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.email.from, to, subject, html, text }),
      });
      if (!res.ok) this.logger.warn(`Resend responded ${res.status}: ${await res.text().catch(() => '')}`);
    } catch (err) {
      this.logger.warn(`Email send failed: ${(err as Error).message}`);
    }
  }

  /** Wraps content in the branded email layout. `bodyHtml` must already be escaped. */
  async layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }) {
    const s = await this.settings.get();
    return `<!doctype html><html><body style="margin:0;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#1f2a5a;padding:18px 24px;color:#fff;font-size:22px;font-weight:bold;font-style:italic">${escapeHtml(s.storeName)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(heading)}</h1>
<div style="font-size:14px;line-height:1.6;color:#333">${bodyHtml}</div>
${cta ? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.url)}" style="background:#c2512f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px;display:inline-block">${escapeHtml(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;color:#777;font-size:12px">Need help? Write to ${escapeHtml(s.supportEmail)} or call ${escapeHtml(s.supportPhone)}.<br>${escapeHtml(s.invoiceAddress)}</td></tr>
</table></td></tr></table></body></html>`;
  }
}
