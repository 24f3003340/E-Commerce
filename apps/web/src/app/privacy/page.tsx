import type { Metadata } from 'next';
import { H2, InfoPage } from '@/components/InfoPage';
import { getStoreInfo } from '@/lib/storeInfo';

export const metadata: Metadata = { title: 'Privacy policy' };

export default async function PrivacyPage() {
  const s = await getStoreInfo();
  return (
    <InfoPage title="Privacy policy" updated="6 October 2026" path="/privacy">
      <p>
        This policy explains how {s.legalName} (&quot;{s.storeName}&quot;) collects and uses your personal data, in line with the Digital
        Personal Data Protection Act, 2023 and the Information Technology Act, 2000.
      </p>
      <H2>What we collect</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Account details: name, email, mobile number and password (stored only as a secure hash).</li>
        <li>Order details: delivery addresses, items purchased, payment status and returns.</li>
        <li>Payment data is handled by our payment partner. We do not store card, UPI PIN or net-banking credentials.</li>
        <li>Technical data such as device and browser information, used to keep the site secure and working.</li>
      </ul>
      <H2>Why we use it</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>To process and deliver orders, handle returns and refunds, and send order updates.</li>
        <li>To provide customer support and prevent fraud.</li>
        <li>To meet legal and tax obligations (for example GST invoices).</li>
      </ul>
      <H2>Who we share it with</H2>
      <p>Only with service providers who help us run the store — payment gateway, courier partners, email providers and hosting — and only as needed for that purpose, or when required by law.</p>
      <H2>Your choices and rights</H2>
      <p>You can view and update your profile and addresses from your account, and ask us to correct or erase your data or withdraw consent by writing to {s.supportEmail}. Some records (such as invoices) must be kept as required by law.</p>
      <H2>Storage and security</H2>
      <p>Data is stored on secure servers with encrypted connections, hashed passwords and restricted access. We keep data only as long as needed for the purposes above or as required by law.</p>
      <H2>Cookies and local storage</H2>
      <p>We use your browser&apos;s storage to keep you signed in, remember your cart, wishlist, delivery pincode and recently viewed items. These stay on your device.</p>
      <H2>Grievance officer</H2>
      <p>For privacy questions or complaints contact our grievance officer at {s.supportEmail}{s.address ? `, ${s.address}` : ''}.</p>
    </InfoPage>
  );
}
