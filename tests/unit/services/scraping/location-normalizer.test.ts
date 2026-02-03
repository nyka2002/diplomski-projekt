import { describe, it, expect, beforeEach } from 'vitest';
import { LocationNormalizer } from '@/services/scraping/normalizers/location-normalizer';

describe('LocationNormalizer', () => {
  let normalizer: LocationNormalizer;

  beforeEach(() => {
    normalizer = new LocationNormalizer();
  });

  describe('normalize', () => {
    describe('city extraction', () => {
      it('should extract Zagreb from simple string', () => {
        const result = normalizer.normalize('Zagreb');

        expect(result.city).toBe('Zagreb');
        expect(result.address).toBe('');
      });

      it('should normalize lowercase city name', () => {
        const result = normalizer.normalize('zagreb');

        expect(result.city).toBe('Zagreb');
      });

      it('should handle "Grad Zagreb" prefix', () => {
        const result = normalizer.normalize('Grad Zagreb');

        expect(result.city).toBe('Zagreb');
      });

      it('should recognize city abbreviations', () => {
        expect(normalizer.normalize('ZG').city).toBe('Zagreb');
        expect(normalizer.normalize('ST').city).toBe('Split');
        expect(normalizer.normalize('RI').city).toBe('Rijeka');
      });
    });

    describe('diacritics handling', () => {
      it('should normalize Varaždin with diacritics', () => {
        const result = normalizer.normalize('varaždin');

        expect(result.city).toBe('Varaždin');
      });

      it('should normalize Varaždin without diacritics', () => {
        const result = normalizer.normalize('varazdin');

        expect(result.city).toBe('Varaždin');
      });

      it('should normalize Šibenik with diacritics', () => {
        const result = normalizer.normalize('Šibenik');

        expect(result.city).toBe('Šibenik');
      });

      it('should normalize Šibenik without diacritics', () => {
        const result = normalizer.normalize('sibenik');

        expect(result.city).toBe('Šibenik');
      });

      it('should normalize Čakovec', () => {
        expect(normalizer.normalize('čakovec').city).toBe('Čakovec');
        expect(normalizer.normalize('cakovec').city).toBe('Čakovec');
      });

      it('should normalize Poreč', () => {
        expect(normalizer.normalize('poreč').city).toBe('Poreč');
        expect(normalizer.normalize('porec').city).toBe('Poreč');
      });
    });

    describe('address parsing', () => {
      it('should extract city and address from comma-separated format', () => {
        const result = normalizer.normalize('Zagreb, Trešnjevka');

        expect(result.city).toBe('Zagreb');
        expect(result.address).toBe('Trešnjevka');
      });

      it('should handle multiple address parts', () => {
        const result = normalizer.normalize('Zagreb, Trešnjevka - sjever');

        expect(result.city).toBe('Zagreb');
        expect(result.address).toContain('Trešnjevka');
      });

      it('should handle dash separator', () => {
        const result = normalizer.normalize('Split - Bačvice');

        expect(result.city).toBe('Split');
        expect(result.address).toBe('Bačvice');
      });

      it('should handle en-dash separator', () => {
        const result = normalizer.normalize('Rijeka – Centar');

        expect(result.city).toBe('Rijeka');
        expect(result.address).toBe('Centar');
      });
    });

    describe('Zagreb districts', () => {
      it('should recognize Trešnjevka', () => {
        const result = normalizer.normalize('Zagreb, Trešnjevka');

        expect(result.city).toBe('Zagreb');
        expect(result.address).toBe('Trešnjevka');
      });

      it('should recognize Maksimir', () => {
        const result = normalizer.normalize('Zagreb, Maksimir');

        expect(result.city).toBe('Zagreb');
        expect(result.address).toBe('Maksimir');
      });

      it('should recognize Novi Zagreb', () => {
        const result = normalizer.normalize('Zagreb, Novi Zagreb');

        expect(result.city).toBe('Zagreb');
        expect(result.address).toBe('Novi Zagreb');
      });

      it('should recognize Dubrava', () => {
        const result = normalizer.normalize('Zagreb, Dubrava');

        expect(result.city).toBe('Zagreb');
        expect(result.address).toBe('Dubrava');
      });
    });

    describe('Split districts', () => {
      it('should recognize Bačvice', () => {
        const result = normalizer.normalize('Split, Bačvice');

        expect(result.city).toBe('Split');
        expect(result.address).toBe('Bačvice');
      });

      it('should recognize Firule', () => {
        const result = normalizer.normalize('Split, Firule');

        expect(result.city).toBe('Split');
        expect(result.address).toBe('Firule');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const result = normalizer.normalize('');

        expect(result.city).toBe('Unknown');
        expect(result.address).toBe('');
      });

      it('should handle unknown city', () => {
        const result = normalizer.normalize('Unknown Village');

        expect(result.city).toBe('Unknown Village');
      });

      it('should handle whitespace', () => {
        const result = normalizer.normalize('  Zagreb  ');

        expect(result.city).toBe('Zagreb');
      });

      it('should handle compound city names', () => {
        const result = normalizer.normalize('Slavonski Brod');

        expect(result.city).toBe('Slavonski Brod');
      });

      it('should handle Velika Gorica', () => {
        const result = normalizer.normalize('velika gorica');

        expect(result.city).toBe('Velika Gorica');
      });
    });

    describe('other major cities', () => {
      it('should recognize Rijeka', () => {
        expect(normalizer.normalize('Rijeka').city).toBe('Rijeka');
        expect(normalizer.normalize('Grad Rijeka').city).toBe('Rijeka');
      });

      it('should recognize Osijek', () => {
        expect(normalizer.normalize('Osijek').city).toBe('Osijek');
        expect(normalizer.normalize('os').city).toBe('Osijek');
      });

      it('should recognize Zadar', () => {
        expect(normalizer.normalize('Zadar').city).toBe('Zadar');
      });

      it('should recognize Dubrovnik', () => {
        expect(normalizer.normalize('Dubrovnik').city).toBe('Dubrovnik');
      });

      it('should recognize Pula', () => {
        expect(normalizer.normalize('Pula').city).toBe('Pula');
      });
    });
  });

  describe('extractDistrict', () => {
    it('should extract Zagreb district from address', () => {
      const district = normalizer.extractDistrict('Trešnjevka sjever', 'Zagreb');

      expect(district).toBe('Trešnjevka');
    });

    it('should extract Split district from address', () => {
      const district = normalizer.extractDistrict('Bačvice', 'Split');

      expect(district).toBe('Bačvice');
    });

    it('should return undefined for unknown district', () => {
      const district = normalizer.extractDistrict('Some Street 123', 'Zagreb');

      expect(district).toBeUndefined();
    });

    it('should return undefined for non-Zagreb/Split cities', () => {
      const district = normalizer.extractDistrict('Centar', 'Rijeka');

      expect(district).toBeUndefined();
    });
  });
});
