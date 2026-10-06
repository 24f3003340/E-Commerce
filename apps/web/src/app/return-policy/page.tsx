import type { Metadata } from 'next';
import { H2, InfoPage } from '@/components/InfoPage';
import { getStoreInfo } from '@/lib/storeInfo';

export const metadata: Metadata = { title: 'Returns & refunds' };

export default async function ReturnPolicyPage() {
  const s = await getStoreInfo();
  return (
    <InfoPage title="Returns & refund policy" updated="6 October 2026" path="/return-policy">
      <H2>Return window</H2>
      <p>
        Most items can be returned within {s.defaultReturnWindowDays} days of delivery. The exact window is shown on each product page — some
        categories have a different window and a few items (such as watches and innerwear) are not returnable for hygiene or safety reasons.
      </p>
      <H2>Conditions</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Items must be unused, unwashed and in original condition with all tags and packaging.</li>
        <li>Wrong size, wrong product, damaged, defective or not-as-described items are always eligible within the window.</li>
      </ul>
      <H2>How to return</H2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Go to My Orders, open the delivered order and choose Return items.</li>
        <li>Select the items, quantity and reason. We review requests within 24–48 hours.</li>
        <li>Once approved, our courier partner picks the items up from your address.</li>
        <li>After a quality check at our warehouse, your refund is processed.</li>
      </ol>
      <H2>Refunds</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Prepaid orders are refunded to the original payment method within 5–7 business days of the quality check.</li>
        <li>Cash-on-delivery orders are refunded by bank transfer / UPI to details you share with us.</li>
        <li>If you used a coupon, the refund is the amount you actually paid for the returned items.</li>
        <li>Shipping and COD charges are non-refundable unless the item was damaged, defective or incorrect.</li>
      </ul>
      <H2>Cancellations</H2>
      <p>You can cancel an order from My Orders until it is packed. Prepaid cancellations are refunded automatically to the original payment method.</p>
      <p>Questions? Write to {s.supportEmail}.</p>
    </InfoPage>
  );
}
