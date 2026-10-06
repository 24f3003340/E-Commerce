import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AdminShell } from '@/components/AdminShell';
import './globals.css';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = { title: 'StyleKart Seller Admin', robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
