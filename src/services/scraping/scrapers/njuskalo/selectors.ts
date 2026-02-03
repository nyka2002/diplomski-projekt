/**
 * Njuskalo CSS Selectors
 *
 * Centralized selectors for Njuskalo.hr website.
 * Separated for easy maintenance when site structure changes.
 *
 * Note: These selectors are based on the website structure as of 2024.
 * They may need updates if Njuskalo changes their HTML structure.
 */

export const NJUSKALO_SELECTORS = {
  // ============================================================================
  // LISTING PAGE (Search Results)
  // ============================================================================
  listingPage: {
    /** Container for all listing items */
    listingContainer: '.EntityList--ListItemRegularAd, .EntityList',

    /** Individual listing card */
    listingCard: '.EntityList-item--Regular, .EntityList-item--VauVau, [class*="EntityList-item"]',

    /** Link to listing detail page */
    listingLink: 'a.link, a[href*="/oglas/"]',

    /** Listing title */
    listingTitle: '.entity-title, .EntityList-item-title, h3.entity-title',

    /** Price display */
    listingPrice: '.price, .price--hrk, .price--eur, [class*="price"]',

    /** Location text */
    listingLocation: '.entity-location, .entity-description-main .location, [class*="location"]',

    /** Surface area */
    listingSurface: '.entity-description-main li:first-child, [data-test="size"]',

    /** Number of rooms */
    listingRooms: '.entity-description-main li:nth-child(2), [data-test="rooms"]',

    /** Listing image */
    listingImage: '.entity-thumbnail img, .entity-image img',

    /** Pagination container */
    pagination: '.Pagination, .pagination',

    /** Next page button */
    nextPageButton: '.Pagination-item--next a, .pagination-next a, a[rel="next"]',

    /** Previous page button */
    prevPageButton: '.Pagination-item--prev a, .pagination-prev a, a[rel="prev"]',

    /** Total results count */
    totalCount: '.entity-count, .results-count, [class*="count"]',

    /** No results message */
    noResults: '.no-results, .empty-results',
  },

  // ============================================================================
  // DETAIL PAGE (Single Listing)
  // ============================================================================
  detailPage: {
    /** Main title */
    title: 'h1.ClassifiedDetailTitle, h1[class*="Title"], h1',

    /** Price */
    price: '.ClassifiedDetailPrice-price, .price-value, [class*="price"]',

    /** Full description text */
    description: '.ClassifiedDetailDescription-text, .description-text, [class*="description"]',

    /** Location */
    location: '.ClassifiedDetailBasicInfo-location, .location-info, [class*="location"]',

    /** Image gallery */
    images: '.ClassifiedDetailGallery-image img, .gallery img, [class*="gallery"] img',

    /** Property info section */
    propertyInfo: '.ClassifiedDetailBasicDetails-item, .property-details li, [class*="details"] li',

    /** Property info label */
    propertyInfoLabel: '.ClassifiedDetailBasicDetails-label, dt, .label',

    /** Property info value */
    propertyInfoValue: '.ClassifiedDetailBasicDetails-value, dd, .value',

    /** Amenities/features list */
    amenities: '.ClassifiedDetailFeatures-item, .features li, [class*="features"] li',

    /** External ID attribute */
    externalIdAttr: 'data-entity-id, data-id, data-ad-id',

    /** Breadcrumb for category */
    breadcrumb: '.Breadcrumbs, .breadcrumb, nav[aria-label="breadcrumb"]',

    /** Seller info */
    sellerInfo: '.ClassifiedDetailOwner, .seller-info, [class*="owner"]',

    /** Contact button */
    contactButton: '.ClassifiedDetailContact, .contact-button, [class*="contact"]',
  },

  // ============================================================================
  // PROPERTY INFO LABELS (Croatian)
  // ============================================================================
  propertyLabels: {
    surfaceArea: ['Stambena površina', 'Površina', 'Kvadratura', 'm²', 'm2'],
    rooms: ['Broj soba', 'Sobe', 'Broj prostorija'],
    bedrooms: ['Spavaće sobe', 'Broj spavaćih soba'],
    bathrooms: ['Kupaonica', 'Kupaonice', 'Broj kupaonica'],
    floor: ['Kat', 'Etaža'],
    totalFloors: ['Ukupno katova', 'Ukupan broj katova'],
    yearBuilt: ['Godina izgradnje', 'Godina gradnje', 'Izgrađeno'],
    heating: ['Grijanje', 'Vrsta grijanja'],
    parking: ['Parking', 'Parkirno mjesto', 'Garaža'],
    condition: ['Stanje', 'Stanje nekretnine'],
    energyClass: ['Energetski razred', 'Energetska klasa'],
  },
} as const;

// Type for the selectors
export type NjuskaloSelectors = typeof NJUSKALO_SELECTORS;
