import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/formatters';

interface PriceDisplayProps {
  price: number;
  currency?: string;
  listingType?: 'rent' | 'sale';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PriceDisplay({
  price,
  currency = 'EUR',
  listingType,
  className,
  size = 'md',
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  return (
    <span
      className={cn(
        'font-bold text-primary',
        sizeClasses[size],
        className
      )}
    >
      {formatPrice(price, currency, listingType)}
    </span>
  );
}
