import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '@/components/InfoPage';
import { inr } from '@/lib/format';
import { getStoreInfo } from '@/lib/storeInfo';

export const metadata: Metadata = { title: 'FAQs' };

export default async function FaqPage() {
  const s = await getStoreInfo();
  const faqs: [string, React.ReactNode][] = [
    ['How do I track my order?', <>Open <Link href="/account/orders" className="text-brand-700 underline">My Orders</Link> or use <Link href="/track" className="text-brand-700 underline">Track Order</Link> with your order ID and email / phone.</>],
    ['Is delivery free?', <>Yes, on orders above {inr(s.freeShippingThreshold)}. Below that a {inr(s.standardShippingFee)} delivery fee applies.</>],
    ['Do you offer cash on delivery?', s.codEnabled ? <>Yes, COD is available on most pincodes with a {inr(s.codFee)} handling fee.</> : <>Not at the moment — please pay online with UPI, card or net banking.</>],
    ['Can I pay online?', s.onlinePayments ? <>Yes — UPI, credit / debit cards, net banking and wallets.</> : <>Online payments are coming soon. For now please choose cash on delivery at checkout.</>],
    ['Why did my order split into several orders?', <>{s.storeName} is a marketplace. When your cart has products from different sellers, each seller gets their own order and ships it separately. You pay the same total.</>],
    ['How do I return an item?', <>From My Orders choose the delivered order → Return items, within {s.defaultReturnWindowDays} days of delivery. See our <Link href="/return-policy" className="text-brand-700 underline">return policy</Link>.</>],
    ['When will I get my refund?', <>Within 5–7 business days after the returned item passes quality check, to your original payment method.</>],
    ['Can I cancel my order?', <>Yes, until it is packed — open the order and tap Cancel order.</>],
    ['How do I find my size?', <>Every apparel product page has a Size chart link next to the sizes.</>],
    ['I forgot my password', <>Use <Link href="/forgot-password" className="text-brand-700 underline">Forgot password</Link> on the login page and we&apos;ll email you a reset link.</>],
  ];
  return (
    <InfoPage title="Frequently asked questions" path="/faq">
      <div className="divide-y divide-gray-100">
        {faqs.map(([q, a]) => (
          <details key={q} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-gray-900">
              {q}
              <span className="text-gray-400 transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-2">{a}</p>
          </details>
        ))}
      </div>
      <p>
        Still need help? <Link href="/contact" className="text-brand-700 underline">Contact us</Link>.
      </p>
    </InfoPage>
  );
}
