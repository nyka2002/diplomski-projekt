'use client';

import { cn } from '@/lib/utils';
import { Building2, MessageCircle, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatWelcomeProps {
  onExampleSelect: (query: string) => void;
  className?: string;
}

const exampleQueries = [
  'Trazim dvosobni stan za najam u Zagrebu do 800€',
  'Namjesten stan s parkirnim mjestom u centru',
  'Kuca s vrtom za kupnju u okolici Splita',
  'Stan s balkonom i liftom do 100.000€',
];

const features = [
  {
    icon: Search,
    title: 'Prirodno pretrazivanje',
    description: 'Opisite sto trazite svojim rijecima',
  },
  {
    icon: Sparkles,
    title: 'AI razumijevanje',
    description: 'Razumijemo sve vase zahtjeve',
  },
  {
    icon: MessageCircle,
    title: 'Interaktivni dijalog',
    description: 'Precizirajte kriterije kroz razgovor',
  },
];

export function ChatWelcome({ onExampleSelect, className }: ChatWelcomeProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      {/* Logo/Icon */}
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Building2 className="h-8 w-8 text-primary" />
      </div>

      {/* Welcome text */}
      <h2 className="text-2xl font-bold mb-2">Dobrodosli!</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Opisite kakvu nekretninu trazite, a ja cu vam pomoci pronaci idealan
        stan ili kucu.
      </p>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 w-full max-w-2xl">
        {features.map((feature, index) => (
          <div
            key={index}
            className="p-4 rounded-lg border bg-card text-card-foreground"
          >
            <feature.icon className="h-6 w-6 text-primary mx-auto mb-2" />
            <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
            <p className="text-xs text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Example queries */}
      <div className="w-full max-w-2xl">
        <p className="text-sm text-muted-foreground mb-3">
          Probajte pitati:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {exampleQueries.map((query, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onExampleSelect(query)}
              className="h-auto py-2 px-4 text-sm font-normal text-left whitespace-normal"
            >
              &quot;{query}&quot;
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
