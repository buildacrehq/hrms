import type { Metadata } from 'next';
import { Overpass } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const overpass = Overpass({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'BA Admin',
  description: 'BA Admin Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${overpass.className} min-h-full bg-gray-50 text-gray-900`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
