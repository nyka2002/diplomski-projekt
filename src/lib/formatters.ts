import { format, formatDistanceToNow } from 'date-fns';
import { hr } from 'date-fns/locale';

/**
 * Format price with currency symbol
 * @param price - The price value
 * @param currency - Currency code (default: EUR)
 * @param listingType - 'rent' or 'sale' to determine if /mj suffix needed
 */
export function formatPrice(
  price: number,
  currency: string = 'EUR',
  listingType?: 'rent' | 'sale'
): string {
  const formatted = new Intl.NumberFormat('hr-HR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  const suffix = listingType === 'rent' ? '/mj' : '';
  return `${formatted} ${currency}${suffix}`;
}

/**
 * Format surface area
 * @param area - Surface area in square meters
 */
export function formatArea(area: number): string {
  return `${area} m²`;
}

/**
 * Format number of rooms
 * @param rooms - Number of rooms
 */
export function formatRooms(rooms: number): string {
  if (rooms === 1) return '1 soba';
  if (rooms >= 2 && rooms <= 4) return `${rooms} sobe`;
  return `${rooms} soba`;
}

/**
 * Format date relative to now
 * @param date - Date to format
 */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: hr });
}

/**
 * Format date as full date
 * @param date - Date to format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'd. MMMM yyyy.', { locale: hr });
}

/**
 * Truncate text to specified length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Format listing type
 * @param type - 'rent' or 'sale'
 */
export function formatListingType(type: 'rent' | 'sale'): string {
  return type === 'rent' ? 'Najam' : 'Prodaja';
}

/**
 * Format property type
 * @param type - Property type string
 */
export function formatPropertyType(
  type: 'apartment' | 'house' | 'office' | 'land' | 'other'
): string {
  const types: Record<string, string> = {
    apartment: 'Stan',
    house: 'Kuca',
    office: 'Poslovni prostor',
    land: 'Zemljiste',
    other: 'Ostalo',
  };
  return types[type] || type;
}
