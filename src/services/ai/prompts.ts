/**
 * AI Prompt Templates
 *
 * Contains system prompts and template functions for AI services.
 */

/**
 * System prompt for the chatbot
 */
export const CHATBOT_SYSTEM_PROMPT = `Ti si AI asistent za pretragu nekretnina u Hrvatskoj.
Pomaži korisnicima pronaći stanove i kuće za kupnju ili najam.
Razgovaraj na hrvatskom jeziku. Budi koncizan i precizan.

Tvoje glavne zadaće:
1. Razumjeti korisnikove zahtjeve za nekretninama
2. Pomoći u definiranju kriterija pretrage (lokacija, cijena, broj soba, pogodnosti)
3. Odgovarati na pitanja o rezultatima pretrage
4. Predlagati dodatne kriterije za bolju pretragu

Uvijek odgovaraj u JSON formatu:
{
  "message": "Tvoja poruka korisniku",
  "suggested_questions": ["Pitanje 1", "Pitanje 2"]
}`;

/**
 * Template for user messages with context
 */
export function CHATBOT_USER_TEMPLATE(
  userMessage: string,
  currentFilters: string,
  hasResults: boolean,
  resultCount?: number
): string {
  let context = `Korisnikova poruka: ${userMessage}\n`;
  context += `Trenutni filtri: ${currentFilters}\n`;

  if (hasResults && resultCount !== undefined) {
    context += `Broj pronađenih rezultata: ${resultCount}\n`;
  }

  context += '\nOdgovori na hrvatskom jeziku u JSON formatu.';

  return context;
}

/**
 * Template for summarizing search results
 */
export function CHATBOT_RESULT_SUMMARY_TEMPLATE(
  listings: Array<{
    title: string;
    price: number;
    location: string;
    rooms?: number;
    surface_area?: number;
    has_parking: boolean;
    has_balcony: boolean;
    is_furnished: boolean;
  }>,
  totalCount: number,
  displayCount: number
): string {
  const lines: string[] = [];

  lines.push(`Pronađeno ${totalCount} nekretnina.`);

  if (displayCount > 0) {
    lines.push(`\nPrvih ${displayCount} rezultata:`);

    for (let i = 0; i < Math.min(displayCount, listings.length); i++) {
      const listing = listings[i];
      const features: string[] = [];

      if (listing.rooms) features.push(`${listing.rooms} sobe`);
      if (listing.surface_area) features.push(`${listing.surface_area} m²`);
      if (listing.has_parking) features.push('parking');
      if (listing.has_balcony) features.push('balkon');
      if (listing.is_furnished) features.push('namješteno');

      lines.push(
        `${i + 1}. ${listing.title} - ${listing.price} € (${listing.location})` +
          (features.length > 0 ? ` [${features.join(', ')}]` : '')
      );
    }
  }

  return lines.join('\n');
}

/**
 * System prompt for query extraction (used by QueryExtractorService)
 */
export const EXTRACTION_SYSTEM_PROMPT = `Ti si AI sustav za ekstrakciju kriterija pretrage nekretnina iz prirodnog jezika.

Analiziraj korisnički upit i ekstrahiraj sljedeće filtere:
- listing_type: "rent" ili "sale"
- property_type: "apartment", "house", "studio", "room"
- price_min, price_max: cijene u EUR
- location: grad ili kvart
- rooms_min, rooms_max: broj soba
- surface_area_min, surface_area_max: kvadratura u m²
- has_parking, has_balcony, has_garage, is_furnished: boolean

Vrati JSON objekt s ekstrahiranim filterima i procjenom pouzdanosti (0-1) za svako polje.

Primjer odgovora:
{
  "filters": {
    "listing_type": "rent",
    "location": "Zagreb",
    "price_max": 700,
    "rooms_min": 2
  },
  "confidence": {
    "overall": 0.85,
    "listing_type": 0.95,
    "price": 0.8,
    "location": 0.9,
    "rooms": 0.85,
    "amenities": 0.7,
    "ambiguous_fields": []
  }
}`;

/**
 * Template for user messages in query extraction
 */
export function EXTRACTION_USER_TEMPLATE(query: string): string {
  return `Korisnički upit: "${query}"

Ekstrahiraj filtere pretrage iz gornjeg upita.
Vrati JSON objekt s filterima i procjenom pouzdanosti.`;
}
