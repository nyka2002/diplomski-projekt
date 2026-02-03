/**
 * Index.hr Oglasi CSS Selectors
 *
 * Centralized selectors for Index.hr/oglasi website.
 * Separated for easy maintenance when site structure changes.
 *
 * Note: These selectors are based on the website structure as of 2024.
 * They may need updates if Index.hr changes their HTML structure.
 */

export const INDEX_SELECTORS = {
  // ============================================================================
  // LISTING PAGE (Search Results)
  // ============================================================================
  listingPage: {
    /** Container for all listing items */
    listingContainer: '.OgsResultList, .results-list, [class*="result"]',

    /** Individual listing card */
    listingCard: '.OglasRow, .oglas-item, [class*="oglas"], .result-item',

    /** Link to listing detail page */
    listingLink: 'a.result-link, a[href*="/oglas/"], .title a',

    /** Listing title */
    listingTitle: '.title, .oglas-title, h3',

    /** Price display */
    listingPrice: '.price, .cijena, [class*="price"], [class*="cijena"]',

    /** Location text */
    listingLocation: '.location, .lokacija, [class*="location"], [class*="lokacija"]',

    /** Surface area */
    listingSurface: '.size, .kvadratura, [class*="size"], [class*="m2"]',

    /** Listing image */
    listingImage: '.thumbnail img, .oglas-image img, img[class*="thumb"]',

    /** Pagination container */
    pagination: '.pagination, .Pagination, [class*="pagination"]',

    /** Next page button */
    nextPageButton: '.pagination .next a, a.next, a[rel="next"], .pagination-next',

    /** Total results count */
    totalCount: '.results-count, .total-count, [class*="count"]',

    /** No results message */
    noResults: '.no-results, .empty-results, .nema-rezultata',
  },

  // ============================================================================
  // DETAIL PAGE (Single Listing)
  // ============================================================================
  detailPage: {
    /** Main title */
    title: 'h1.title, h1.oglas-title, h1, .detail-title',

    /** Price */
    price: '.price, .cijena, .detail-price, [class*="price"]',

    /** Full description text */
    description: '.description, .opis, .detail-description, [class*="description"]',

    /** Location */
    location: '.location, .lokacija, .detail-location, [class*="location"]',

    /** Image gallery */
    images: '.gallery img, .slike img, [class*="gallery"] img, .detail-images img',

    /** Property info section */
    propertyInfo: '.details-row, .info-row, .property-detail, [class*="detail"] li',

    /** Property info label */
    propertyInfoLabel: '.label, dt, .detail-label',

    /** Property info value */
    propertyInfoValue: '.value, dd, .detail-value',

    /** Amenities/features list */
    amenities: '.features li, .amenities li, .oprema li, [class*="feature"]',

    /** Breadcrumb for category */
    breadcrumb: '.breadcrumb, nav[aria-label="breadcrumb"], .kategorija',

    /** Seller info */
    sellerInfo: '.seller, .prodavac, .kontakt-info',
  },

  // ============================================================================
  // PROPERTY INFO LABELS (Croatian)
  // ============================================================================
  propertyLabels: {
    surfaceArea: ['Površina', 'Kvadratura', 'm²', 'm2', 'Stambena površina'],
    rooms: ['Broj soba', 'Sobe', 'Broj prostorija'],
    bedrooms: ['Spavaće sobe', 'Broj spavaćih soba'],
    bathrooms: ['Kupaonica', 'Kupaonice', 'Broj kupaonica'],
    floor: ['Kat', 'Etaža', 'Sprat'],
    totalFloors: ['Ukupno katova', 'Ukupan broj katova', 'Katnost'],
    yearBuilt: ['Godina izgradnje', 'Godina gradnje', 'Izgrađeno'],
    heating: ['Grijanje', 'Vrsta grijanja'],
    parking: ['Parking', 'Parkirno mjesto', 'Garaža'],
    condition: ['Stanje', 'Stanje nekretnine'],
  },
} as const;

// Type for the selectors
export type IndexSelectors = typeof INDEX_SELECTORS;
