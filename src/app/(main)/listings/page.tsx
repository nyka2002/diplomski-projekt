'use client';

import { MainLayout } from '@/components/layout';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { useListings } from '@/hooks/useListings';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function ListingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get('page')) || 1;
  const listingType = searchParams.get('listing_type') as
    | 'rent'
    | 'sale'
    | null;

  const { data, isLoading, error } = useListings({
    listing_type: listingType || undefined,
    page,
    limit: 20,
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/listings?${params.toString()}`);
  };

  const listings = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Svi oglasi</h1>
          {pagination && (
            <p className="text-muted-foreground">
              Prikazano {listings.length} od {pagination.total} oglasa
            </p>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          <Button
            variant={!listingType ? 'default' : 'outline'}
            size="sm"
            onClick={() => router.push('/listings')}
          >
            Svi
          </Button>
          <Button
            variant={listingType === 'rent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => router.push('/listings?listing_type=rent')}
          >
            Najam
          </Button>
          <Button
            variant={listingType === 'sale' ? 'default' : 'outline'}
            size="sm"
            onClick={() => router.push('/listings?listing_type=sale')}
          >
            Prodaja
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Doslo je do greske pri ucitavanju oglasa. Pokusajte ponovo.
          </AlertDescription>
        </Alert>
      )}

      {/* Listings grid */}
      <ListingGrid listings={listings} isLoading={isLoading} />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prethodna
          </Button>
          <span className="text-sm text-muted-foreground">
            Stranica {page} od {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= pagination.totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Sljedeca
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ListingsPage() {
  return (
    <MainLayout>
      <div className="container py-6">
        <Suspense
          fallback={
            <div className="space-y-6">
              <div className="h-8 w-48 bg-muted animate-pulse rounded" />
              <ListingGrid listings={[]} isLoading />
            </div>
          }
        >
          <ListingsContent />
        </Suspense>
      </div>
    </MainLayout>
  );
}
