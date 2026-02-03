import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ListingCardSkeletonProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export function ListingCardSkeleton({
  variant = 'default',
  className,
}: ListingCardSkeletonProps) {
  const isCompact = variant === 'compact';

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Image skeleton */}
      <Skeleton
        className={cn(
          'w-full',
          isCompact ? 'aspect-[4/3]' : 'aspect-[16/10]'
        )}
      />

      {/* Content skeleton */}
      <CardContent className={cn('p-4', isCompact && 'p-3')}>
        {/* Title */}
        <Skeleton className={cn('h-5 w-3/4', isCompact && 'h-4')} />

        {/* Location */}
        <Skeleton className="h-4 w-1/2 mt-2" />

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Amenities */}
        {!isCompact && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
