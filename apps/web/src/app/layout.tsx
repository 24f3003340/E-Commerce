import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StoreProvider } from '@/context/StoreProvider';
import { serverGetSafe } from '@/lib/server';
import type { Category } from '@/lib/types';
import './globals.css';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';

export const metadata: Metadata = {
  title: { default: `${STORE_NAME} — Online Fashion Store`, template: `%s | ${STORE_NAME}` },
  description: 'Shop the latest fashion for men, women and kids. Easy returns, COD and secure payments.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await serverGetSafe<Category[]>('/categories', []);
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <Header categories={categories} />
          <main className="min-h-[60vh]">{children}</main>
          <Footer categories={categories} />
        </StoreProvider>
      </body>
    </html>
  );
}
