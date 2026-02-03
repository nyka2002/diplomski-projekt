'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Navigation } from './Navigation';
import { MobileNav } from './MobileNav';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  user?: {
    email: string;
    name?: string;
  } | null;
  onLogout?: () => void;
}

export function Header({ user = null, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <MobileNav isAuthenticated={!!user} />
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline-block">
              Agent za nekretnine
            </span>
          </Link>
          <Navigation />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
