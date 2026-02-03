import {
  Car,
  Fence,
  Warehouse,
  Sofa,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AmenityType = 'parking' | 'balcony' | 'garage' | 'furnished';

interface AmenityIconProps {
  type: AmenityType;
  active?: boolean;
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const amenityConfig: Record<
  AmenityType,
  { icon: LucideIcon; label: string }
> = {
  parking: { icon: Car, label: 'Parking' },
  balcony: { icon: Fence, label: 'Balkon' },
  garage: { icon: Warehouse, label: 'Garaza' },
  furnished: { icon: Sofa, label: 'Namjesteno' },
};

const sizeConfig = {
  sm: { icon: 'h-3.5 w-3.5', text: 'text-xs' },
  md: { icon: 'h-4 w-4', text: 'text-sm' },
  lg: { icon: 'h-5 w-5', text: 'text-base' },
};

export function AmenityIcon({
  type,
  active = true,
  showLabel = false,
  className,
  size = 'md',
}: AmenityIconProps) {
  const config = amenityConfig[type];
  const Icon = config.icon;
  const sizes = sizeConfig[size];

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        !active && 'opacity-40',
        className
      )}
      title={config.label}
    >
      <Icon className={sizes.icon} />
      {showLabel && (
        <span className={cn(sizes.text, 'text-muted-foreground')}>
          {config.label}
        </span>
      )}
    </div>
  );
}

interface AmenityListProps {
  hasParking?: boolean;
  hasBalcony?: boolean;
  hasGarage?: boolean;
  isFurnished?: boolean;
  showLabels?: boolean;
  showInactive?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AmenityList({
  hasParking,
  hasBalcony,
  hasGarage,
  isFurnished,
  showLabels = false,
  showInactive = false,
  className,
  size = 'md',
}: AmenityListProps) {
  const amenities: { type: AmenityType; active: boolean }[] = [
    { type: 'parking', active: !!hasParking },
    { type: 'balcony', active: !!hasBalcony },
    { type: 'garage', active: !!hasGarage },
    { type: 'furnished', active: !!isFurnished },
  ];

  const visibleAmenities = showInactive
    ? amenities
    : amenities.filter((a) => a.active);

  if (visibleAmenities.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {visibleAmenities.map(({ type, active }) => (
        <AmenityIcon
          key={type}
          type={type}
          active={active}
          showLabel={showLabels}
          size={size}
        />
      ))}
    </div>
  );
}
