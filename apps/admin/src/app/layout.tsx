import type { Metadata } from 'next';
import { AdminShell } from '@/components/AdminShell';
import './globals.css';

export const metadata: Metadata = { title: 'Store Admin', robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
