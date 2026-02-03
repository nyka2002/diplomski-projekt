'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { AuthGuard } from '@/components/auth';
import { useAuth } from '@/providers';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useSavedListings } from '@/hooks/useSavedListings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  History,
  Search,
  Building2,
  MapPin,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { savedListings, isLoading: savedLoading } = useSavedListings();
  const { searches, stats, isLoading: searchLoading } = useSearchHistory(true);

  const userName =
    user?.user_metadata?.name || user?.email?.split('@')[0] || 'Korisnik';

  return (
    <MainLayout>
      <div className="container py-6">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dobrodosli, {userName}!</h1>
          <p className="text-muted-foreground">
            Ovdje mozete pregledati spremljene oglase i povijest pretrazivanja.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  {savedLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <p className="text-3xl font-bold">{savedListings.length}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Spremljenih oglasa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <div>
                  {searchLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <p className="text-3xl font-bold">
                      {stats?.total_searches || 0}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">Pretrazivanja</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  {searchLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className="text-xl font-bold">
                      {stats?.most_common_city || '-'}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Najcesci grad
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Saved listings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Spremljeni oglasi
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/saved">
                  Vidi sve
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {savedLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : savedListings.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nemate spremljenih oglasa</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link href="/">Zapocnite pretragu</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedListings.slice(0, 3).map(({ listing }) => (
                    <Link
                      key={listing.id}
                      href={`/listings/${listing.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{listing.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {listing.location_city} •{' '}
                          {listing.price.toLocaleString()} {listing.price_currency}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search history */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Povijest pretrazivanja
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/history">
                  Vidi sve
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {searchLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : searches.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nemate povijest pretrazivanja</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link href="/">Zapocnite pretragu</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {searches.slice(0, 3).map((search) => (
                    <div
                      key={search.id}
                      className="p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <p className="font-medium truncate">{search.query_text}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(search.created_at).toLocaleDateString('hr-HR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
