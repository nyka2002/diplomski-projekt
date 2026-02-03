'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Database,
  Server,
  Cpu,
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  Search,
  Loader2,
} from 'lucide-react';

interface SystemStats {
  database: {
    totalListings: number;
    listingsBySource: Record<string, number>;
    listingsByType: Record<string, number>;
    recentListings: number;
  };
  scraping: {
    queueStatus: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    } | null;
    lastJobTime: string | null;
  };
  searches: {
    totalSearches: number;
    recentSearches: number;
  };
  system: {
    redisConnected: boolean;
    redisType: string;
  };
}

export default function AdminPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/analytics');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Error', {
        description: 'Failed to load system statistics',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const triggerScrape = async (type: 'full' | 'rent' | 'sale') => {
    if (!apiKey) {
      toast.error('API Key Required', {
        description: 'Please enter the admin API key',
      });
      return;
    }

    setTriggering(true);
    try {
      const response = await fetch('/api/admin/scraping/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          type: type === 'full' ? 'full' : 'listing_type',
          listingType: type === 'full' ? undefined : type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger scrape');
      }

      toast.success('Scrape Triggered', {
        description: `Job ${data.jobId} has been queued`,
      });

      // Refresh stats after a short delay
      setTimeout(fetchStats, 2000);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to trigger scrape',
      });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <MainLayout>
      <div className="container py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              System monitoring and management
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${stats?.system.redisConnected ? 'bg-green-100' : 'bg-red-100'}`}>
                  {stats?.system.redisConnected ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Redis</p>
                  {loading ? (
                    <Skeleton className="h-6 w-20" />
                  ) : (
                    <p className="font-semibold">
                      {stats?.system.redisConnected ? 'Connected' : 'Disconnected'}
                    </p>
                  )}
                  {stats?.system.redisType && (
                    <p className="text-xs text-muted-foreground">
                      ({stats.system.redisType})
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Listings</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {stats?.database.totalListings.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Search className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Searches</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {stats?.searches.totalSearches.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <Activity className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Queue Jobs</p>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {stats?.scraping.queueStatus
                        ? stats.scraping.queueStatus.waiting + stats.scraping.queueStatus.active
                        : 0}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Listings by Source */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Listings by Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {stats?.database.listingsBySource &&
                    Object.entries(stats.database.listingsBySource).map(([source, count]) => (
                      <div
                        key={source}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <span className="font-medium capitalize">{source}</span>
                        <span className="text-muted-foreground">
                          {count.toLocaleString()} listings
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Listings by Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Listings by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {stats?.database.listingsByType &&
                    Object.entries(stats.database.listingsByType).map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <span className="font-medium capitalize">
                          {type === 'rent' ? 'Najam' : 'Prodaja'}
                        </span>
                        <span className="text-muted-foreground">
                          {count.toLocaleString()} listings
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Queue Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Scraping Queue Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24" />
            ) : stats?.scraping.queueStatus ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-yellow-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.scraping.queueStatus.waiting}
                  </p>
                  <p className="text-sm text-yellow-700">Waiting</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.scraping.queueStatus.active}
                  </p>
                  <p className="text-sm text-blue-700">Active</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {stats.scraping.queueStatus.completed}
                  </p>
                  <p className="text-sm text-green-700">Completed</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {stats.scraping.queueStatus.failed}
                  </p>
                  <p className="text-sm text-red-700">Failed</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Queue not available (Redis not connected)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Trigger Scraping */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Manual Scraping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Admin API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your ADMIN_API_KEY"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => triggerScrape('full')}
                  disabled={triggering || !stats?.system.redisConnected}
                >
                  {triggering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Full Scrape
                </Button>
                <Button
                  variant="outline"
                  onClick={() => triggerScrape('rent')}
                  disabled={triggering || !stats?.system.redisConnected}
                >
                  Scrape Rentals
                </Button>
                <Button
                  variant="outline"
                  onClick={() => triggerScrape('sale')}
                  disabled={triggering || !stats?.system.redisConnected}
                >
                  Scrape Sales
                </Button>
              </div>
              {!stats?.system.redisConnected && (
                <p className="text-sm text-muted-foreground">
                  Redis is not connected. Scraping requires a running worker.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
