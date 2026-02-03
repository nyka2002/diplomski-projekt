import { cn } from '@/lib/utils';
import { SearchX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyResultsProps {
  onReset?: () => void;
  className?: string;
}

export function EmptyResults({ onReset, className }: EmptyResultsProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Nema rezultata</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Nismo pronasli oglase koji odgovaraju vasim kriterijima. Pokusajte
        promijeniti uvjete pretrage.
      </p>
      {onReset && (
        <Button variant="outline" onClick={onReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Nova pretraga
        </Button>
      )}
    </div>
  );
}
