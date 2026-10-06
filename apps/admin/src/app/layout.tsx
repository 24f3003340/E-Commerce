import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { AdminShell } from '@/components/AdminShell';
import './globals.css';

const body = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = { title: 'StyleKart Seller Admin', robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={body.variable}>
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
