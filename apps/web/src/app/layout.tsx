import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StoreProvider } from '@/context/StoreProvider';
import { serverGetSafe } from '@/lib/server';
import type { Category } from '@/lib/types';
import './globals.css';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${STORE_NAME} — Online Shopping for Fashion`, template: `%s | ${STORE_NAME}` },
  description: 'Shop the latest fashion for men, women and kids. Free delivery over ₹999, easy 7-day returns, COD and secure payments.',
};

export const viewport: Viewport = { themeColor: '#ffffff' };

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await serverGetSafe<Category[]>('/categories', []);
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <StoreProvider>
          <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 py-1.5 text-center text-xs font-semibold text-white">
            Free delivery above ₹999 · Easy 7-day returns · Cash on delivery
          </div>
          <Header categories={categories} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer categories={categories} />
        </StoreProvider>
      </body>
    </html>
  );
}
