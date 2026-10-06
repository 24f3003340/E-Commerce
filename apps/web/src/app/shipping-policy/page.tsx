import type { Metadata } from 'next';
import { H2, InfoPage } from '@/components/InfoPage';
import { inr } from '@/lib/format';
import { getStoreInfo } from '@/lib/storeInfo';

export const metadata: Metadata = { title: 'Shipping policy' };

export default async function ShippingPolicyPage() {
  const s = await getStoreInfo();
  return (
    <InfoPage title="Shipping policy" updated="6 October 2026" path="/shipping-policy">
      <H2>Where we deliver</H2>
      <p>We deliver across India through trusted courier partners. Enter your pincode on any product page to check delivery and the expected date.</p>
      <H2>Delivery charges</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Standard delivery: FREE on orders above {inr(s.freeShippingThreshold)}, otherwise {inr(s.standardShippingFee)}.</li>
        <li>Express delivery: {inr(s.expressShippingFee)}.</li>
        {s.codEnabled && <li>Cash on delivery: an additional {inr(s.codFee)} handling fee.</li>}
      </ul>
      <H2>Delivery time</H2>
      <p>Orders are packed within 1–2 business days. Standard delivery usually takes 2–4 days to metro cities and 4–7 days elsewhere; express is faster. Remote areas may take longer.</p>
      <H2>Tracking</H2>
      <p>Once shipped you will receive the courier name and tracking number by email and on your Orders page. You can also track any order from the Track Order page.</p>
      <H2>Failed deliveries</H2>
      <p>If the courier cannot deliver after multiple attempts, the order is returned to us. Prepaid orders are refunded after we receive the package, less any shipping charges.</p>
    </InfoPage>
  );
}
