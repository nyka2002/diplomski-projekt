import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { QueryProvider, ThemeProvider, AuthProvider } from '@/providers';
import { Toaster } from '@/components/common/Toaster';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'Agent za nekretnine - AI pretrazivanje nekretnina',
  description:
    'Pronadite idealnu nekretninu uz pomoc AI asistenta. Pretrazujte stanove i kuce za najam ili kupnju prirodnim jezikom.',
  keywords: ['nekretnine', 'stanovi', 'kuce', 'najam', 'kupnja', 'Zagreb', 'Hrvatska', 'AI'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
