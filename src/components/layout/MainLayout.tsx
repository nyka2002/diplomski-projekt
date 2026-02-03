'use client';

import { type ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAuth } from '@/providers';

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function MainLayout({ children, showFooter = true }: MainLayoutProps) {
  const { user, signOut } = useAuth();

  const userInfo = user
    ? {
        email: user.email || '',
        name: user.user_metadata?.name,
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={userInfo} onLogout={signOut} />
      <main className="flex-1">{children}</main>
      {showFooter && <Footer />}
    </div>
  );
}
