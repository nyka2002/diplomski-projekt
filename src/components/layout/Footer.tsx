import Link from 'next/link';
import { Building2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-bold">Agent za nekretnine</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              AI asistent za pronalazak idealnog stana ili kuce. Pretrazujte
              prirodnim jezikom.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Brze poveznice</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pocetna
                </Link>
              </li>
              <li>
                <Link
                  href="/listings"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Svi oglasi
                </Link>
              </li>
              <li>
                <Link
                  href="/listings?listing_type=rent"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Najam
                </Link>
              </li>
              <li>
                <Link
                  href="/listings?listing_type=sale"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Prodaja
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold mb-4">Racun</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Prijava
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Registracija
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Moj profil
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/saved"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Spremljeni oglasi
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4">Kontakt</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Diplomski projekt</li>
              <li>FER, Zagreb</li>
              <li>2024/2025</li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Agent za nekretnine. Diplomski projekt.</p>
        </div>
      </div>
    </footer>
  );
}
