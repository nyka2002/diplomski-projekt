/**
 * Scraping Configuration
 *
 * Central configuration for all scraping operations including:
 * - Browser settings
 * - Rate limiting
 * - Retry logic
 * - Source-specific configurations
 */

export const SCRAPING_CONFIG = {
  // ============================================================================
  // BROWSER SETTINGS
  // ============================================================================
  browser: {
    /** Run browser in headless mode */
    headless: true,
    /** Default timeout for page operations (ms) */
    timeout: 30000,
    /** User agent string to use */
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    /** Viewport dimensions */
    viewport: {
      width: 1920,
      height: 1080,
    },
    /** Locale for browser context */
    locale: 'hr-HR',
  },

  // ============================================================================
  // BROWSER POOL SETTINGS
  // ============================================================================
  pool: {
    /** Maximum number of concurrent browser instances */
    maxBrowsers: 2,
    /** Maximum contexts per browser */
    maxContextsPerBrowser: 3,
    /** Time (ms) before idle browser is closed */
    browserIdleTimeout: 300000, // 5 minutes
    /** Time (ms) before idle context is closed */
    contextIdleTimeout: 60000, // 1 minute
  },

  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  rateLimit: {
    /** Maximum requests per minute */
    requestsPerMinute: 20,
    /** Delay between page requests (ms) */
    delayBetweenRequests: 3000, // 3 seconds
    /** Delay between detail page fetches (ms) */
    delayBetweenListings: 1000, // 1 second
    /** Random delay variance (ms) - adds randomness to avoid detection */
    delayVariance: 500,
  },

  // ============================================================================
  // RETRY SETTINGS
  // ============================================================================
  retry: {
    /** Maximum number of retry attempts */
    maxRetries: 3,
    /** Initial delay before first retry (ms) */
    initialDelay: 1000,
    /** Maximum delay between retries (ms) */
    maxDelay: 30000,
    /** Multiplier for exponential backoff */
    backoffMultiplier: 2,
    /** Error codes that should trigger a retry */
    retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMITED'],
  },

  // ============================================================================
  // SOURCE-SPECIFIC CONFIGURATIONS
  // ============================================================================
  sources: {
    njuskalo: {
      /** Base URL for Njuskalo */
      baseUrl: 'https://www.njuskalo.hr',
      /** Path for rental apartments */
      rentApartmentsPath: '/iznajmljivanje-stanova',
      /** Path for apartments for sale */
      saleApartmentsPath: '/prodaja-stanova',
      /** Path for rental houses */
      rentHousesPath: '/iznajmljivanje-kuca',
      /** Path for houses for sale */
      saleHousesPath: '/prodaja-kuca',
      /** Maximum pages to scrape per run */
      maxPagesPerScrape: 10,
      /** Selector wait timeout (ms) */
      selectorTimeout: 10000,
    },

    indexOglasi: {
      /** Base URL for Index.hr oglasi */
      baseUrl: 'https://www.index.hr',
      /** Path for real estate listings */
      nekretninePath: '/oglasi/nekretnine',
      /** Path for rental listings */
      rentPath: '/oglasi/nekretnine/iznajmljivanje',
      /** Path for sale listings */
      salePath: '/oglasi/nekretnine/prodaja',
      /** Maximum pages to scrape per run */
      maxPagesPerScrape: 10,
      /** Selector wait timeout (ms) */
      selectorTimeout: 10000,
    },
  },

  // ============================================================================
  // SCRAPING DEFAULTS
  // ============================================================================
  defaults: {
    /** Default maximum pages if not specified */
    maxPages: 5,
    /** Default timeout for scraping operations (ms) */
    operationTimeout: 60000 * 10, // 10 minutes
    /** Batch size for database inserts */
    batchSize: 50,
  },
} as const;

// Type exports for configuration
export type ScrapingConfig = typeof SCRAPING_CONFIG;
export type SourceConfig = (typeof SCRAPING_CONFIG.sources)[keyof typeof SCRAPING_CONFIG.sources];
