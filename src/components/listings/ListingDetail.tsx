'use client';

import { cn } from '@/lib/utils';
import {
  MapPin,
  BedDouble,
  Maximize2,
  Calendar,
  ExternalLink,
  Share2,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingGallery } from './ListingGallery';
import { SaveButton } from './SaveButton';
import { AmenityList } from '@/components/common/AmenityIcon';
import {
  formatPrice,
  formatArea,
  formatRooms,
  formatRelativeDate,
  formatListingType,
  formatPropertyType,
} from '@/lib/formatters';
import type { Listing } from '@/types/listing';

interface ListingDetailProps {
  listing: Listing;
  isSaved?: boolean;
  className?: string;
}

export function ListingDetail({
  listing,
  isSaved = false,
  className,
}: ListingDetailProps) {
  const {
    title,
    description,
    price,
    price_currency,
    listing_type,
    property_type,
    location_city,
    location_address,
    rooms,
    bedrooms,
    bathrooms,
    surface_area,
    has_parking,
    has_balcony,
    has_garage,
    is_furnished,
    amenities,
    images,
    url,
    scraped_at,
    id,
  } = listing;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `${title} - ${formatPrice(price, price_currency, listing_type)}`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Gallery */}
      <ListingGallery images={images} title={title} />

      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={listing_type === 'rent' ? 'default' : 'secondary'}
                className={cn(
                  listing_type === 'rent'
                    ? 'bg-blue-500 hover:bg-blue-500'
                    : 'bg-green-500 hover:bg-green-500 text-white'
                )}
              >
                {formatListingType(listing_type)}
              </Badge>
              <Badge variant="outline">
                <Building2 className="h-3 w-3 mr-1" />
                {formatPropertyType(property_type)}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                {location_address
                  ? `${location_address}, ${location_city}`
                  : location_city}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold text-primary">
              {formatPrice(price, price_currency, listing_type)}
            </p>
            <p className="text-sm text-muted-foreground flex items-center justify-end gap-1 mt-1">
              <Calendar className="h-3 w-3" />
              Objavljeno {formatRelativeDate(scraped_at)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <SaveButton
            listingId={id}
            isSaved={isSaved}
            variant="default"
            size="lg"
          />
          <Button variant="outline" size="lg" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Podijeli
          </Button>
          {url && (
            <Button variant="outline" size="lg" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Originalni oglas
              </a>
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rooms && (
          <Card>
            <CardContent className="p-4 text-center">
              <BedDouble className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="font-semibold">{formatRooms(rooms)}</p>
              {bedrooms && (
                <p className="text-xs text-muted-foreground">
                  {bedrooms} spavace
                </p>
              )}
            </CardContent>
          </Card>
        )}
        {surface_area && (
          <Card>
            <CardContent className="p-4 text-center">
              <Maximize2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="font-semibold">{formatArea(surface_area)}</p>
              <p className="text-xs text-muted-foreground">Povrsina</p>
            </CardContent>
          </Card>
        )}
        {bathrooms && (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl mb-1">{bathrooms}</p>
              <p className="text-xs text-muted-foreground">Kupaonica</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4 text-center">
            <p className="font-semibold text-lg">
              {formatPrice(
                surface_area ? Math.round(price / surface_area) : price,
                price_currency
              )}
            </p>
            <p className="text-xs text-muted-foreground">po m²</p>
          </CardContent>
        </Card>
      </div>

      {/* Amenities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pogodnosti</CardTitle>
        </CardHeader>
        <CardContent>
          <AmenityList
            hasParking={has_parking}
            hasBalcony={has_balcony}
            hasGarage={has_garage}
            isFurnished={is_furnished}
            showLabels
            showInactive
            size="lg"
            className="flex-wrap gap-4"
          />
          {amenities && Object.keys(amenities).length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Dodatne pogodnosti:
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(amenities).map(([key, value]) =>
                  value ? (
                    <Badge key={key} variant="secondary">
                      {key}
                    </Badge>
                  ) : null
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Opis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
