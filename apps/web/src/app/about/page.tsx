import type { Metadata } from 'next';
import { H2, InfoPage } from '@/components/InfoPage';
import { inr } from '@/lib/format';
import { getStoreInfo } from '@/lib/storeInfo';

export const metadata: Metadata = { title: 'About us' };

export default async function AboutPage() {
  const s = await getStoreInfo();
  return (
    <InfoPage title={`About ${s.storeName}`} path="/about">
      <p>
        {s.storeName} is an online fashion store for men, women and kids. We bring you everyday styles — tees, shirts, jeans, dresses,
        kurtas, footwear and accessories — at honest prices, delivered to your doorstep anywhere in India.
      </p>
      <H2>What we promise</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Original products with clear size charts and real photos.</li>
        <li>Free delivery on orders above {inr(s.freeShippingThreshold)}.</li>
        <li>Easy {s.defaultReturnWindowDays}-day returns on eligible items.</li>
        <li>Secure payments by UPI, cards, net banking and wallets{s.codEnabled ? ', plus cash on delivery' : ''}.</li>
      </ul>
      <H2>Who we are</H2>
      <p>
        {s.storeName} is operated by {s.legalName}
        {s.address ? `, ${s.address}` : ''}.{s.gstin ? ` GSTIN: ${s.gstin}.` : ''}
      </p>
    </InfoPage>
  );
}
