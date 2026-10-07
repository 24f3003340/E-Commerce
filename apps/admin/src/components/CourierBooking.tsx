'use client';

import { useState } from 'react';
import { Field, Modal } from './ui';

export interface PackageSize {
  weightKg: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
}

/**
 * Package form for booking a courier pickup through Shiprocket. The courier charges by the higher
 * of actual weight and volumetric weight (L × B × H ÷ 5000), so both are asked for.
 */
export function CourierBookingModal({ onClose, onBook }: { onClose: () => void; onBook: (size: PackageSize) => Promise<boolean> }) {
  const [size, setSize] = useState({ weightKg: '0.5', lengthCm: '30', breadthCm: '25', heightCm: '5' });
  const [busy, setBusy] = useState(false);
  const num = (k: keyof typeof size) => ({
    value: size[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSize((s) => ({ ...s, [k]: e.target.value })),
  });
  const volumetric = (Number(size.lengthCm) * Number(size.breadthCm) * Number(size.heightCm)) / 5000;

  return (
    <Modal title="Book courier pickup" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const done = await onBook({
            weightKg: Number(size.weightKg),
            lengthCm: Number(size.lengthCm),
            breadthCm: Number(size.breadthCm),
            heightCm: Number(size.heightCm),
          });
          setBusy(false);
          if (done) onClose();
        }}
      >
        <p className="text-sm text-gray-600">
          Shiprocket picks the recommended courier, assigns the AWB and schedules a pickup from the pickup address. Pack the parcel and stick the label on it.
        </p>
        <Field label="Packed weight (kg)"><input className="input" type="number" min="0.05" max="50" step="0.01" required {...num('weightKg')} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Length (cm)"><input className="input" type="number" min="1" max="200" step="0.5" required {...num('lengthCm')} /></Field>
          <Field label="Breadth (cm)"><input className="input" type="number" min="1" max="200" step="0.5" required {...num('breadthCm')} /></Field>
          <Field label="Height (cm)"><input className="input" type="number" min="1" max="200" step="0.5" required {...num('heightCm')} /></Field>
        </div>
        {volumetric > Number(size.weightKg) && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
            Volumetric weight is {volumetric.toFixed(2)} kg — the courier will charge for that. A smaller box costs less.
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Booking with Shiprocket…' : 'Book pickup & get AWB'}</button>
      </form>
    </Modal>
  );
}
