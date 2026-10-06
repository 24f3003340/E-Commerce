import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Outfit } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StoreProvider } from '@/context/StoreProvider';
import { serverGetSafe } from '@/lib/server';
import type { Category } from '@/lib/types';
import './globals.css';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';
const sans = Outfit({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${STORE_NAME} — Trendy fashion at loot prices`, template: `%s | ${STORE_NAME}` },
  description: 'Shop the latest fashion for men, women and kids. Free delivery over ₹999, easy 7-day returns, COD and secure payments.',
};

export const viewport: Viewport = { themeColor: '#d4ff3f' };

export const dynamic = 'force-dynamic';

const ANNOUNCEMENTS = ['₹999+ pe FREE delivery 🚚', '7 din easy returns 🔁', 'Cash on Delivery available ✌️', 'Har week fresh drops ✨', 'Code WELCOME10 = 10% off first order 🎉'];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await serverGetSafe<Category[]>('/categories', []);
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>
        <StoreProvider>
          <div className="overflow-hidden border-b-2 border-black bg-accent-400 py-1.5 text-xs font-extrabold text-black" aria-label="Store highlights">
            <div className="flex w-max animate-marquee gap-8 whitespace-nowrap motion-reduce:animate-none">
              {Array.from({ length: 4 }).flatMap((_, k) =>
                ANNOUNCEMENTS.map((a, i) => (
                  <span key={`${k}-${i}`} aria-hidden={k > 0} className="flex items-center gap-8">
                    {a} <span>✦</span>
                  </span>
                )),
              )}
            </div>
          </div>
          <Header categories={categories} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer categories={categories} />
        </StoreProvider>
      </body>
    </html>
  );
}
