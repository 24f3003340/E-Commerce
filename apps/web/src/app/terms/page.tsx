import type { Metadata } from 'next';
import { H2, InfoPage } from '@/components/InfoPage';
import { getStoreInfo } from '@/lib/storeInfo';

export const metadata: Metadata = { title: 'Terms of use' };

export default async function TermsPage() {
  const s = await getStoreInfo();
  return (
    <InfoPage title="Terms of use" updated="6 October 2026" path="/terms">
      <p>
        These terms govern your use of the {s.storeName} website operated by {s.legalName} (&quot;we&quot;, &quot;us&quot;). By using the website or
        placing an order you agree to these terms.
      </p>
      <H2>Accounts</H2>
      <p>You are responsible for keeping your login details safe and for all activity on your account. You must be 18 or older, or use the site under a parent&apos;s supervision.</p>
      <H2>Products and prices</H2>
      <p>
        We try to show products, colours and prices accurately. Prices are in Indian Rupees and include GST. If a product is listed at an
        incorrect price or is unavailable, we may cancel the order and fully refund any amount paid.
      </p>
      <H2>Marketplace sellers</H2>
      <p>
        Some products are sold by independent sellers registered on {s.storeName}. The product page and your order show who the seller is.
        The seller is responsible for the product, its description and the tax invoice; we verify sellers, handle payments and support,
        and help with returns. An order with items from several sellers is split into one order per seller.
      </p>
      <H2>Orders and payment</H2>
      <p>
        An order is confirmed once payment succeeds (or, for cash on delivery, when we confirm it). Payments are processed by our payment
        partner; we never store your card details. Coupons are subject to their stated conditions and may be withdrawn at any time.
      </p>
      <H2>Shipping, returns and refunds</H2>
      <p>Delivery, returns and refunds are governed by our Shipping policy and Returns &amp; refund policy, which form part of these terms.</p>
      <H2>Acceptable use</H2>
      <p>Do not misuse the website — no fraudulent orders, scraping, attempts to break security, or posting unlawful content in reviews.</p>
      <H2>Intellectual property</H2>
      <p>Content on this website, including logos, photos and text, belongs to us or our licensors and may not be reused without permission.</p>
      <H2>Liability</H2>
      <p>To the extent permitted by law, our liability for any order is limited to the amount paid for that order.</p>
      <H2>Governing law</H2>
      <p>These terms are governed by the laws of India. Disputes are subject to the jurisdiction of the courts where {s.legalName} is registered.</p>
      <H2>Contact</H2>
      <p>For questions or grievances write to {s.supportEmail}.</p>
    </InfoPage>
  );
}
