'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import type { ExtractedFilters as ExtractedFiltersType } from '@/types/search';
import { formatPrice, formatListingType } from '@/lib/formatters';

interface ExtractedFiltersProps {
  filters: ExtractedFiltersType;
  onRemove?: (key: keyof ExtractedFiltersType) => void;
  className?: string;
}

export function ExtractedFilters({
  filters,
  onRemove,
  className,
}: ExtractedFiltersProps) {
  const filterItems: { key: keyof ExtractedFiltersType; label: string }[] = [];

  if (filters.listing_type) {
    filterItems.push({
      key: 'listing_type',
      label: formatListingType(filters.listing_type),
    });
  }

  if (filters.property_type) {
    filterItems.push({
      key: 'property_type',
      label: filters.property_type,
    });
  }

  if (filters.location) {
    filterItems.push({
      key: 'location',
      label: filters.location,
    });
  }

  if (filters.price_max) {
    filterItems.push({
      key: 'price_max',
      label: `Do ${formatPrice(filters.price_max)}`,
    });
  }

  if (filters.price_min) {
    filterItems.push({
      key: 'price_min',
      label: `Od ${formatPrice(filters.price_min)}`,
    });
  }

  if (filters.rooms_min || filters.rooms_max) {
    const roomsLabel =
      filters.rooms_min && filters.rooms_max
        ? `${filters.rooms_min}-${filters.rooms_max} sobe`
        : filters.rooms_min
          ? `${filters.rooms_min}+ soba`
          : `Do ${filters.rooms_max} sobe`;
    filterItems.push({
      key: 'rooms_min',
      label: roomsLabel,
    });
  }

  if (filters.surface_area_min || filters.surface_area_max) {
    const areaLabel =
      filters.surface_area_min && filters.surface_area_max
        ? `${filters.surface_area_min}-${filters.surface_area_max} m²`
        : filters.surface_area_min
          ? `${filters.surface_area_min}+ m²`
          : `Do ${filters.surface_area_max} m²`;
    filterItems.push({
      key: 'surface_area_min',
      label: areaLabel,
    });
  }

  if (filters.has_parking) {
    filterItems.push({ key: 'has_parking', label: 'Parking' });
  }

  if (filters.has_balcony) {
    filterItems.push({ key: 'has_balcony', label: 'Balkon' });
  }

  if (filters.has_garage) {
    filterItems.push({ key: 'has_garage', label: 'Garaza' });
  }

  if (filters.is_furnished) {
    filterItems.push({ key: 'is_furnished', label: 'Namjesteno' });
  }

  if (filterItems.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Filter className="h-3.5 w-3.5" />
        Prepoznati filteri
      </p>
      <div className="flex flex-wrap gap-1.5">
        {filterItems.map(({ key, label }) => (
          <Badge
            key={key}
            variant="secondary"
            className="text-xs font-normal gap-1"
          >
            {label}
            {onRemove && (
              <button
                onClick={() => onRemove(key)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}
