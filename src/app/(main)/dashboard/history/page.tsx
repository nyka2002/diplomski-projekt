'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { AuthGuard } from '@/components/auth';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  ArrowLeft,
  History,
  Search,
  Trash2,
  MapPin,
} from 'lucide-react';
import { formatRelativeDate, formatListingType } from '@/lib/formatters';

export default function SearchHistoryPage() {
  return (
    <AuthGuard>
      <SearchHistoryContent />
    </AuthGuard>
  );
}

function SearchHistoryContent() {
  const { searches, total, isLoading, error, deleteSearch, isDeleting } =
    useSearchHistory();

  return (
    <MainLayout>
      <div className="container py-6 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" className="mb-4" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Natrag na profil
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Povijest pretrazivanja</h1>
              <p className="text-muted-foreground">
                {isLoading ? 'Ucitavanje...' : `${total} pretrazivanja`}
              </p>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Doslo je do greske pri ucitavanju povijesti pretrazivanja.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && searches.length === 0 && (
          <div className="text-center py-16">
            <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
            <h2 className="text-xl font-semibold mb-2">Nema pretrazivanja</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Vasa pretrazivanja ce se prikazati ovdje. Zapocnite pretrazivanje
              nekretnina.
            </p>
            <Button asChild>
              <Link href="/">
                <Search className="h-4 w-4 mr-2" />
                Nova pretraga
              </Link>
            </Button>
          </div>
        )}

        {/* Search history list */}
        {!isLoading && searches.length > 0 && (
          <div className="space-y-4">
            {searches.map((search) => (
              <Card key={search.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium mb-2">{search.query_text}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatRelativeDate(search.created_at)}</span>
                        {search.extracted_filters?.listing_type && (
                          <>
                            <span>•</span>
                            <Badge variant="secondary" className="text-xs">
                              {formatListingType(
                                search.extracted_filters.listing_type
                              )}
                            </Badge>
                          </>
                        )}
                        {search.extracted_filters?.location && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {search.extracted_filters.location}
                            </span>
                          </>
                        )}
                        {search.extracted_filters?.price_max && (
                          <>
                            <span>•</span>
                            <span>
                              Do {search.extracted_filters.price_max.toLocaleString()}{' '}
                              EUR
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => deleteSearch(search.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
