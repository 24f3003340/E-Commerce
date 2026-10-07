import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../common/config';

// Shiprocket tokens last 10 days; refresh a day early
const TOKEN_TTL_MS = 9 * 24 * 3_600_000;

/** Thin Shiprocket REST client (https://apidocs.shiprocket.in). */
@Injectable()
export class ShiprocketClient {
  private readonly logger = new Logger(ShiprocketClient.name);
  private token?: { value: string; expiresAt: number };

  get enabled() {
    return config.shiprocket.enabled;
  }

  async createOrder(payload: object): Promise<{ orderId: string; shipmentId: string }> {
    const res = await this.call('/orders/create/adhoc', payload);
    if (!res.order_id || !res.shipment_id) throw this.fail('create order', res);
    return { orderId: String(res.order_id), shipmentId: String(res.shipment_id) };
  }

  /** Lets Shiprocket pick the recommended courier and returns the AWB. */
  async assignAwb(shipmentId: string): Promise<{ awb: string; courier: string }> {
    const res = await this.call('/courier/assign/awb', { shipment_id: shipmentId });
    const data = (res.response as { data?: Record<string, unknown> } | undefined)?.data;
    if (!data?.awb_code) throw this.fail('assign AWB', res);
    return { awb: String(data.awb_code), courier: String(data.courier_name ?? 'Courier') };
  }

  async schedulePickup(shipmentId: string) {
    await this.call('/courier/generate/pickup', { shipment_id: [shipmentId] });
  }

  async label(shipmentId: string): Promise<string | undefined> {
    const res = await this.call('/courier/generate/label', { shipment_id: [shipmentId] });
    return typeof res.label_url === 'string' ? res.label_url : undefined;
  }

  async cancelOrders(orderIds: string[]) {
    await this.call('/orders/cancel', { ids: orderIds.map(Number) });
  }

  /** Registers a pickup address. Shiprocket asks the account owner to verify new addresses once. */
  async addPickupLocation(p: { nickname: string; name: string; email: string; phone: string; address: string; address2?: string; city: string; state: string; pincode: string }) {
    try {
      await this.call('/settings/company/addpickup', {
        pickup_location: p.nickname,
        name: p.name,
        email: p.email,
        phone: p.phone,
        address: p.address,
        address_2: p.address2 ?? '',
        city: p.city,
        state: p.state,
        country: 'India',
        pin_code: p.pincode,
      });
    } catch (err) {
      // Already registered (e.g. a retry) is fine
      if (/already exists/i.test((err as Error).message)) return;
      throw err;
    }
  }

  private async login(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const res = await fetch(`${config.shiprocket.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.shiprocket.email, password: config.shiprocket.password }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || typeof json.token !== 'string') {
      this.logger.error(`Shiprocket login failed: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
      throw new BadGatewayException('Could not log in to Shiprocket. Check SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD (API user).');
    }
    this.token = { value: json.token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return json.token;
  }

  private async call(path: string, body: object, retried = false): Promise<Record<string, unknown>> {
    if (!this.enabled) throw new ServiceUnavailableException('Courier booking is not set up yet');
    const res = await fetch(`${config.shiprocket.apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.login()}` },
      body: JSON.stringify(body),
    });
    if (res.status === 401 && !retried) {
      this.token = undefined;
      return this.call(path, body, true);
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw this.fail(path, json, res.status);
    return json;
  }

  /** Shiprocket's own message is the most useful thing to show the person booking. */
  private fail(action: string, json: Record<string, unknown>, status?: number) {
    this.logger.error(`Shiprocket ${action} failed: ${status ?? ''} ${JSON.stringify(json).slice(0, 500)}`);
    const errors = json.errors && typeof json.errors === 'object' ? Object.values(json.errors as Record<string, unknown>).flat().join(' ') : '';
    const message = [json.message, errors].filter((m) => typeof m === 'string' && m).join(' — ');
    return new BadGatewayException(`Shiprocket: ${message || `could not ${action}`}`);
  }
}
