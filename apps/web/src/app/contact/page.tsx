import type { Metadata } from 'next';
import { Icon } from '@/components/icons';
import { H2, InfoPage } from '@/components/InfoPage';
import { getStoreInfo } from '@/lib/storeInfo';

export const metadata: Metadata = { title: 'Contact us' };

export default async function ContactPage() {
  const s = await getStoreInfo();
  return (
    <InfoPage title="Contact us" path="/contact">
      <p>We are happy to help with orders, returns, sizes or anything else. Please keep your order number handy.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`mailto:${s.supportEmail}`} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:border-brand-500">
          <Icon name="bell" className="h-5 w-5 text-brand-600" />
          <span>
            <span className="block font-semibold text-gray-900">Email</span>
            {s.supportEmail}
          </span>
        </a>
        {s.supportPhone && (
          <a href={`tel:${s.supportPhone.replace(/\s/g, '')}`} className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:border-brand-500">
            <Icon name="headset" className="h-5 w-5 text-brand-600" />
            <span>
              <span className="block font-semibold text-gray-900">Phone</span>
              {s.supportPhone}
            </span>
          </a>
        )}
        {s.whatsappNumber && (
          <a href={`https://wa.me/${s.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:border-emerald-500">
            <span className="text-lg" aria-hidden>💬</span>
            <span>
              <span className="block font-semibold text-gray-900">WhatsApp</span>
              Chat with us
            </span>
          </a>
        )}
      </div>
      <H2>Support hours</H2>
      <p>Monday to Saturday, 10:00 AM – 7:00 PM IST. We reply to emails within 24–48 hours.</p>
      <H2>Registered address</H2>
      <p>
        {s.legalName}
        {s.address && (
          <>
            <br />
            {s.address}
          </>
        )}
        {s.gstin && (
          <>
            <br />
            GSTIN: {s.gstin}
          </>
        )}
      </p>
      <H2>Grievance officer</H2>
      <p>
        As required under the Consumer Protection (E-Commerce) Rules, 2020 and the IT Rules, complaints can be sent to our grievance
        officer at {s.supportEmail}. We acknowledge complaints within 48 hours and resolve them within one month.
      </p>
    </InfoPage>
  );
}
