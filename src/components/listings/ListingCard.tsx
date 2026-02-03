'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Maximize2, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice, formatArea, formatRooms, truncateText } from '@/lib/formatters';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AmenityList } from '@/components/common/AmenityIcon';
import { SaveButton } from './SaveButton';
import type { Listing } from '@/types/listing';

interface ListingCardProps {
  listing: Listing;
  isSaved?: boolean;
  onSaveChange?: (saved: boolean) => void;
  showSaveButton?: boolean;
  variant?: 'default' | 'compact' | 'featured';
  className?: string;
}

export function ListingCard({
  listing,
  isSaved = false,
  onSaveChange,
  showSaveButton = true,
  variant = 'default',
  className,
}: ListingCardProps) {
  const {
    id,
    title,
    price,
    price_currency,
    listing_type,
    location_city,
    rooms,
    surface_area,
    has_parking,
    has_balcony,
    has_garage,
    is_furnished,
    images,
  } = listing;

  const imageUrl = images?.[0] || '/placeholder-listing.jpg';
  const isCompact = variant === 'compact';
  const isFeatured = variant === 'featured';

  return (
    <Link href={`/listings/${id}`} className={cn('block group', className)}>
      <Card
        className={cn(
          'overflow-hidden transition-all hover:shadow-lg',
          isFeatured && 'border-primary'
        )}
      >
        {/* Image */}
        <div
          className={cn(
            'relative overflow-hidden bg-muted',
            isCompact ? 'aspect-[4/3]' : 'aspect-[16/10]'
          )}
        >
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />

          {/* Price badge */}
          <div className="absolute top-3 left-3">
            <Badge
              variant="secondary"
              className="bg-background/90 backdrop-blur text-foreground font-bold text-sm px-2.5 py-1"
            >
              {formatPrice(price, price_currency, listing_type)}
            </Badge>
          </div>

          {/* Listing type badge */}
          <div className="absolute top-3 right-12">
            <Badge
              variant={listing_type === 'rent' ? 'default' : 'outline'}
              className={cn(
                listing_type === 'rent'
                  ? 'bg-blue-500 hover:bg-blue-500'
                  : 'bg-green-500 hover:bg-green-500 text-white border-0'
              )}
            >
              {listing_type === 'rent' ? 'Najam' : 'Prodaja'}
            </Badge>
          </div>

          {/* Save button */}
          {showSaveButton && (
            <div className="absolute top-3 right-3">
              <SaveButton
                listingId={id}
                isSaved={isSaved}
                onSaveChange={onSaveChange}
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className={cn('p-4', isCompact && 'p-3')}>
          {/* Title */}
          <h3
            className={cn(
              'font-semibold text-foreground group-hover:text-primary transition-colors',
              isCompact ? 'text-sm line-clamp-1' : 'text-base line-clamp-2'
            )}
          >
            {truncateText(title, isCompact ? 40 : 60)}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className={cn('truncate', isCompact ? 'text-xs' : 'text-sm')}>
              {location_city}
            </span>
          </div>

          {/* Stats */}
          <div
            className={cn(
              'flex items-center gap-4 mt-3 text-muted-foreground',
              isCompact ? 'text-xs' : 'text-sm'
            )}
          >
            {rooms && (
              <div className="flex items-center gap-1">
                <BedDouble className="h-4 w-4" />
                <span>{formatRooms(rooms)}</span>
              </div>
            )}
            {surface_area && (
              <div className="flex items-center gap-1">
                <Maximize2 className="h-4 w-4" />
                <span>{formatArea(surface_area)}</span>
              </div>
            )}
          </div>

          {/* Amenities */}
          {!isCompact && (
            <div className="mt-3 pt-3 border-t">
              <AmenityList
                hasParking={has_parking}
                hasBalcony={has_balcony}
                hasGarage={has_garage}
                isFurnished={is_furnished}
                size="sm"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
