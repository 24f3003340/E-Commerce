import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StoreProvider } from '@/context/StoreProvider';
import { serverGetSafe } from '@/lib/server';
import type { Category } from '@/lib/types';
import './globals.css';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${STORE_NAME} — Easy, everyday fashion`, template: `%s | ${STORE_NAME}` },
  description: 'Comfy, casual fashion for men, women and kids. Free delivery over ₹999, easy 7-day returns and cash on delivery.',
};

export const viewport: Viewport = { themeColor: '#faf6f0' };

export const dynamic = 'force-dynamic';

const ANNOUNCEMENTS = ['Free delivery over ₹999', 'Easy 7-day returns', 'Cash on delivery available', 'New drops every week'];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await serverGetSafe<Category[]>('/categories', []);
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <StoreProvider>
          <div className="overflow-hidden bg-ink-900 py-2 text-xs font-medium text-ink-50" aria-label="Store highlights">
            <div className="flex w-max animate-marquee gap-10 whitespace-nowrap motion-reduce:animate-none">
              {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS, ...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map((a, i) => (
                <span key={i} className="flex items-center gap-10" aria-hidden={i >= ANNOUNCEMENTS.length}>
                  {a} <span className="text-brand-400">✺</span>
                </span>
              ))}
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
