import type { Metadata } from 'next';
import { SellerShell } from '@/components/SellerShell';

export const metadata: Metadata = { title: 'DukaanX Seller Panel', robots: { index: false, follow: false } };

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <SellerShell>{children}</SellerShell>;
}
