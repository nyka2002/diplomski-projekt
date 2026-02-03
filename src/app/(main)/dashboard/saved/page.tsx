'use client';

import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { AuthGuard } from '@/components/auth';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { useSavedListings } from '@/hooks/useSavedListings';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Heart, Search } from 'lucide-react';

export default function SavedListingsPage() {
  return (
    <AuthGuard>
      <SavedListingsContent />
    </AuthGuard>
  );
}

function SavedListingsContent() {
  const { savedListings, total, isLoading, error, removeListing } =
    useSavedListings();

  const listings = savedListings.map((item) => item.listing);
  const savedIds = listings.map((l) => l.id);

  const handleSaveChange = (listingId: string, saved: boolean) => {
    if (!saved) {
      removeListing(listingId);
    }
  };

  return (
    <MainLayout>
      <div className="container py-6">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" className="mb-4" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Natrag na profil
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Heart className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Spremljeni oglasi</h1>
              <p className="text-muted-foreground">
                {isLoading
                  ? 'Ucitavanje...'
                  : `${total} spremljenih oglasa`}
              </p>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Doslo je do greske pri ucitavanju spremljenih oglasa.
            </AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {!isLoading && listings.length === 0 && (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
            <h2 className="text-xl font-semibold mb-2">
              Nemate spremljenih oglasa
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Pregledajte oglase i kliknite na ikonu srca da biste spremili
              oglase koje zelite pratiti.
            </p>
            <Button asChild>
              <Link href="/">
                <Search className="h-4 w-4 mr-2" />
                Pretrazi oglase
              </Link>
            </Button>
          </div>
        )}

        {/* Listings grid */}
        {(isLoading || listings.length > 0) && (
          <ListingGrid
            listings={listings}
            savedListingIds={savedIds}
            onSaveChange={handleSaveChange}
            isLoading={isLoading}
            skeletonCount={6}
          />
        )}
      </div>
    </MainLayout>
  );
}
