'use client';

import { use } from 'react';
import { MainLayout } from '@/components/layout';
import { ListingDetail } from '@/components/listings/ListingDetail';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { useListing } from '@/hooks/useListings';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ListingDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useListing(id);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container py-6 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="aspect-[16/9] w-full rounded-lg mb-6" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !data?.data?.listing) {
    return (
      <MainLayout>
        <div className="container py-6 max-w-4xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Greska</AlertTitle>
            <AlertDescription>
              {error?.message === 'Listing not found'
                ? 'Oglas nije pronaden. Moguce je da je uklonjen.'
                : 'Doslo je do greske pri ucitavanju oglasa. Pokusajte ponovo.'}
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/listings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Natrag na oglase
            </Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { listing, is_saved, similar_listings } = data.data;

  return (
    <MainLayout>
      <div className="container py-6">
        {/* Back button */}
        <Button variant="ghost" className="mb-4" asChild>
          <Link href="/listings">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Natrag na oglase
          </Link>
        </Button>

        <div className="max-w-4xl mx-auto">
          <ListingDetail listing={listing} isSaved={is_saved} />

          {/* Similar listings */}
          {similar_listings && similar_listings.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-4">Slicni oglasi</h2>
              <ListingGrid
                listings={similar_listings}
                variant="compact"
                className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
