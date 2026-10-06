'use client';

import { Field } from './ui';

export interface SellerDetailsForm {
  name: string;
  phone: string;
  storeName: string;
  description: string;
  gstin: string;
  pan: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
}

export const EMPTY_SELLER_DETAILS: SellerDetailsForm = {
  name: '',
  phone: '',
  storeName: '',
  description: '',
  gstin: '',
  pan: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  upiId: '',
};

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

/** Store, business, pickup address and bank fields — used by seller sign-up and profile. */
export function SellerDetailsFields({ form, onChange }: { form: SellerDetailsForm; onChange: (patch: Partial<SellerDetailsForm>) => void }) {
  const bind = (k: keyof SellerDetailsForm) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange({ [k]: e.target.value }),
  });
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="font-bold">Store & contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Store name (shown to customers)"><input className="input" required minLength={2} {...bind('storeName')} /></Field>
          <Field label="Your name"><input className="input" required minLength={2} {...bind('name')} /></Field>
          <Field label="Mobile number"><input className="input" required inputMode="numeric" pattern="[6-9]\d{9}" title="10 digit mobile number" {...bind('phone')} /></Field>
        </div>
        <Field label="About your store (optional)"><textarea className="input" rows={2} {...bind('description')} /></Field>
      </section>
      <section className="space-y-4">
        <h2 className="font-bold">Business (GST & PAN)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GSTIN" hint="Needed to sell taxable goods online in India. Leave empty only if you are exempt."><input className="input uppercase" maxLength={15} {...bind('gstin')} /></Field>
          <Field label="PAN"><input className="input uppercase" maxLength={10} {...bind('pan')} /></Field>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-bold">Pickup address</h2>
        <Field label="Address line 1"><input className="input" required minLength={3} {...bind('addressLine1')} /></Field>
        <Field label="Address line 2 (optional)"><input className="input" {...bind('addressLine2')} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City"><input className="input" required {...bind('city')} /></Field>
          <Field label="State">
            <select className="input" required {...bind('state')}>
              <option value="">Select…</option>
              {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Pincode"><input className="input" required inputMode="numeric" pattern="[1-9]\d{5}" title="6 digit pincode" {...bind('pincode')} /></Field>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-bold">Payout details</h2>
        <p className="text-sm text-gray-500">Your earnings are transferred here after delivery. Fill a bank account or a UPI ID.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder name"><input className="input" {...bind('bankAccountName')} /></Field>
          <Field label="Account number"><input className="input" inputMode="numeric" {...bind('bankAccountNumber')} /></Field>
          <Field label="IFSC"><input className="input uppercase" maxLength={11} {...bind('bankIfsc')} /></Field>
          <Field label="UPI ID"><input className="input" placeholder="name@bank" {...bind('upiId')} /></Field>
        </div>
      </section>
    </div>
  );
}
