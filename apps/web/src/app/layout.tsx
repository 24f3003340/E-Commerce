import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StoreProvider } from '@/context/StoreProvider';
import { serverGetSafe } from '@/lib/server';
import { SITE_URL } from '@/lib/site';
import { getStoreInfo } from '@/lib/storeInfo';
import type { Category } from '@/lib/types';
import './globals.css';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { type: 'website', siteName: STORE_NAME, locale: 'en_IN' },
  title: { default: `${STORE_NAME} — Online Shopping for Fashion`, template: `%s | ${STORE_NAME}` },
  description: 'Shop the latest fashion for men, women and kids. Free delivery over ₹999, easy 7-day returns, COD and secure payments.',
};

export const viewport: Viewport = { themeColor: '#0a1c36' };

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, store] = await Promise.all([serverGetSafe<Category[]>('/categories', []), getStoreInfo()]);
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <StoreProvider>
          <div className="bg-navy-950 py-1.5 text-center text-xs font-medium text-white">
            Free delivery on orders above ₹999 · Easy 7-day returns · Cash on delivery available
          </div>
          <Header categories={categories} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer categories={categories} onlinePayments={store.onlinePayments} sellerRegistrationOpen={store.sellerRegistrationOpen} />
          {store.whatsappNumber && (
            <a
              href={`https://wa.me/${store.whatsappNumber}?text=${encodeURIComponent('Hi! I need help with my order.')}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with us on WhatsApp"
              className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lift transition hover:scale-105 lg:bottom-6"
            >
              <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
                <path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3Zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7Zm5.9-8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.3-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.4c.2.2 2.3 3.6 5.7 5 2.1.9 3 1 4 .8.7-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4Z" />
              </svg>
            </a>
          )}
        </StoreProvider>
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
