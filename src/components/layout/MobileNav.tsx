'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Home, Building, User, LogIn, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Pocetna', icon: Home },
  { href: '/listings', label: 'Oglasi', icon: Building },
  { href: '/dashboard', label: 'Moj profil', icon: User },
];

interface MobileNavProps {
  isAuthenticated?: boolean;
}

export function MobileNav({ isAuthenticated = false }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Otvori izbornik</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px]">
        <SheetHeader>
          <SheetTitle className="text-left">Agent za nekretnine</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-4 mt-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          {!isAuthenticated && (
            <>
              <div className="border-t my-2" />
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
              >
                <LogIn className="h-5 w-5" />
                Prijava
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent"
              >
                <UserPlus className="h-5 w-5" />
                Registracija
              </Link>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
