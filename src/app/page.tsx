'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import { ChatInterface } from '@/components/chat';
import { SearchResults } from '@/components/search';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Grid3X3 } from 'lucide-react';
import type { Listing } from '@/types/listing';

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);

  return (
    <MainLayout showFooter={false}>
      {/* Desktop: Split view */}
      <div className="hidden lg:flex h-[calc(100vh-64px)]">
        {/* Chat panel */}
        <div className="w-2/5 border-r flex flex-col">
          <ChatInterface onListingsChange={setListings} className="h-full" />
        </div>

        {/* Results panel */}
        <div className="w-3/5 overflow-auto">
          {listings.length > 0 ? (
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Pronadeno {listings.length} oglasa
              </h2>
              <SearchResults listings={listings} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
              <Grid3X3 className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-center max-w-sm">
                Rezultati pretrazivanja ce se prikazati ovdje nakon sto unesete
                upit u chat.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile/Tablet: Tabs view */}
      <div className="lg:hidden h-[calc(100vh-64px)]">
        <Tabs defaultValue="chat" className="h-full flex flex-col">
          <TabsList className="w-full rounded-none border-b bg-background h-12">
            <TabsTrigger
              value="chat"
              className="flex-1 data-[state=active]:bg-muted rounded-none"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="flex-1 data-[state=active]:bg-muted rounded-none relative"
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Rezultati
              {listings.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {listings.length > 99 ? '99+' : listings.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
            <ChatInterface
              onListingsChange={setListings}
              className="h-full"
              showFilters={false}
            />
          </TabsContent>

          <TabsContent value="results" className="flex-1 m-0 overflow-auto">
            {listings.length > 0 ? (
              <div className="p-4">
                <SearchResults listings={listings} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
                <Grid3X3 className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-center max-w-sm">
                  Unesite upit u chat da biste vidjeli rezultate pretrazivanja.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
