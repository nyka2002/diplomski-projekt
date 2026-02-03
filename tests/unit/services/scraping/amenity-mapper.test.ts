import { describe, it, expect, beforeEach } from 'vitest';
import { AmenityMapper } from '@/services/scraping/normalizers/amenity-mapper';

describe('AmenityMapper', () => {
  let mapper: AmenityMapper;

  beforeEach(() => {
    mapper = new AmenityMapper();
  });

  describe('mapAmenities', () => {
    describe('parking detection', () => {
      it('should detect "parking"', () => {
        const result = mapper.mapAmenities(['parking']);

        expect(result.has_parking).toBe(true);
      });

      it('should detect "parkirno mjesto"', () => {
        const result = mapper.mapAmenities(['parkirno mjesto']);

        expect(result.has_parking).toBe(true);
      });

      it('should detect "parkiralište"', () => {
        const result = mapper.mapAmenities(['parkiralište']);

        expect(result.has_parking).toBe(true);
      });
    });

    describe('garage detection', () => {
      it('should detect "garaža"', () => {
        const result = mapper.mapAmenities(['garaža']);

        expect(result.has_garage).toBe(true);
      });

      it('should detect "garaza" (without diacritics)', () => {
        const result = mapper.mapAmenities(['garaza']);

        expect(result.has_garage).toBe(true);
      });

      it('should detect "garažno mjesto"', () => {
        const result = mapper.mapAmenities(['garažno mjesto']);

        expect(result.has_garage).toBe(true);
      });
    });

    describe('balcony/terrace detection', () => {
      it('should detect "balkon"', () => {
        const result = mapper.mapAmenities(['balkon']);

        expect(result.has_balcony).toBe(true);
      });

      it('should detect "terasa"', () => {
        const result = mapper.mapAmenities(['terasa']);

        expect(result.has_balcony).toBe(true);
      });

      it('should detect "lodža"', () => {
        const result = mapper.mapAmenities(['lodža']);

        expect(result.has_balcony).toBe(true);
      });

      it('should detect "logia"', () => {
        const result = mapper.mapAmenities(['logia']);

        expect(result.has_balcony).toBe(true);
      });
    });

    describe('furnished detection', () => {
      it('should detect "namješteno"', () => {
        const result = mapper.mapAmenities(['namješteno']);

        expect(result.is_furnished).toBe(true);
      });

      it('should detect "namjesteno" (without diacritics)', () => {
        const result = mapper.mapAmenities(['namjesteno']);

        expect(result.is_furnished).toBe(true);
      });

      it('should detect "potpuno namješteno"', () => {
        const result = mapper.mapAmenities(['potpuno namješteno']);

        expect(result.is_furnished).toBe(true);
      });

      it('should detect "opremljeno"', () => {
        const result = mapper.mapAmenities(['opremljeno']);

        expect(result.is_furnished).toBe(true);
      });

      it('should detect "furnished"', () => {
        const result = mapper.mapAmenities(['furnished']);

        expect(result.is_furnished).toBe(true);
      });
    });

    describe('unfurnished detection', () => {
      it('should set is_furnished to false for "nenamješteno"', () => {
        const result = mapper.mapAmenities(['nenamješteno']);

        expect(result.is_furnished).toBe(false);
      });

      it('should set is_furnished to false for "bez namještaja"', () => {
        const result = mapper.mapAmenities(['bez namještaja']);

        expect(result.is_furnished).toBe(false);
      });

      it('should set is_furnished to false for "prazan"', () => {
        const result = mapper.mapAmenities(['prazan']);

        expect(result.is_furnished).toBe(false);
      });
    });

    describe('additional amenities', () => {
      it('should detect air conditioning', () => {
        const result = mapper.mapAmenities(['klima']);

        expect(result.additional.air_conditioning).toBe(true);
      });

      it('should detect "klimatizacija"', () => {
        const result = mapper.mapAmenities(['klimatizacija']);

        expect(result.additional.air_conditioning).toBe(true);
      });

      it('should detect central heating', () => {
        const result = mapper.mapAmenities(['centralno grijanje']);

        expect(result.additional.central_heating).toBe(true);
      });

      it('should detect elevator/lift', () => {
        const result = mapper.mapAmenities(['lift']);

        expect(result.additional.elevator).toBe(true);
      });

      it('should detect "dizalo"', () => {
        const result = mapper.mapAmenities(['dizalo']);

        expect(result.additional.elevator).toBe(true);
      });

      it('should detect internet', () => {
        const result = mapper.mapAmenities(['internet']);

        expect(result.additional.internet).toBe(true);
      });

      it('should detect alarm', () => {
        const result = mapper.mapAmenities(['alarm']);

        expect(result.additional.alarm).toBe(true);
      });

      it('should detect garden/vrt', () => {
        const result = mapper.mapAmenities(['vrt']);

        expect(result.additional.garden).toBe(true);
      });

      it('should detect pool/bazen', () => {
        const result = mapper.mapAmenities(['bazen']);

        expect(result.additional.pool).toBe(true);
      });

      it('should detect sea view', () => {
        const result = mapper.mapAmenities(['pogled na more']);

        expect(result.additional.sea_view).toBe(true);
      });

      it('should detect pets allowed', () => {
        const result = mapper.mapAmenities(['pet friendly']);

        expect(result.additional.pets_allowed).toBe(true);
      });
    });

    describe('multiple amenities', () => {
      it('should detect multiple amenities at once', () => {
        const result = mapper.mapAmenities([
          'parking',
          'balkon',
          'garaža',
          'namješteno',
          'klima',
          'lift',
        ]);

        expect(result.has_parking).toBe(true);
        expect(result.has_balcony).toBe(true);
        expect(result.has_garage).toBe(true);
        expect(result.is_furnished).toBe(true);
        expect(result.additional.air_conditioning).toBe(true);
        expect(result.additional.elevator).toBe(true);
      });
    });

    describe('case insensitivity', () => {
      it('should handle uppercase amenities', () => {
        const result = mapper.mapAmenities(['PARKING', 'BALKON']);

        expect(result.has_parking).toBe(true);
        expect(result.has_balcony).toBe(true);
      });

      it('should handle mixed case', () => {
        const result = mapper.mapAmenities(['Parking', 'Balkon']);

        expect(result.has_parking).toBe(true);
        expect(result.has_balcony).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty array', () => {
        const result = mapper.mapAmenities([]);

        expect(result.has_parking).toBe(false);
        expect(result.has_balcony).toBe(false);
        expect(result.has_garage).toBe(false);
        expect(result.is_furnished).toBe(false);
        expect(Object.keys(result.additional)).toHaveLength(0);
      });

      it('should handle unknown amenities', () => {
        const result = mapper.mapAmenities(['unknown amenity', 'something else']);

        expect(result.has_parking).toBe(false);
        expect(result.has_balcony).toBe(false);
        expect(result.has_garage).toBe(false);
        expect(result.is_furnished).toBe(false);
      });

      it('should handle amenities with extra whitespace', () => {
        const result = mapper.mapAmenities(['  parking  ', '  balkon  ']);

        expect(result.has_parking).toBe(true);
        expect(result.has_balcony).toBe(true);
      });
    });
  });

  describe('extractFromDescription', () => {
    it('should extract parking from description', () => {
      const result = mapper.extractFromDescription(
        'Lijep stan s parkingom i balkonom u centru grada.'
      );

      expect(result.has_parking).toBe(true);
      expect(result.has_balcony).toBe(true);
    });

    it('should extract furnished status from description', () => {
      const result = mapper.extractFromDescription('Potpuno namješteno, useljivo odmah.');

      expect(result.is_furnished).toBe(true);
    });

    it('should extract unfurnished status from description', () => {
      const result = mapper.extractFromDescription('Stan je nenamješteno, prazan.');

      expect(result.is_furnished).toBe(false);
    });

    it('should extract additional amenities', () => {
      // Note: The implementation matches exact patterns like "klima", "centralno grijanje", "lift"
      // Croatian grammatical forms like "klimu" (accusative) need exact pattern match
      const result = mapper.extractFromDescription(
        'Stan ima klima, centralno grijanje i lift.'
      );

      expect(result.additional?.air_conditioning).toBe(true);
      expect(result.additional?.central_heating).toBe(true);
      expect(result.additional?.elevator).toBe(true);
    });

    it('should detect sea view', () => {
      const result = mapper.extractFromDescription('Prekrasan pogled na more.');

      expect(result.additional?.sea_view).toBe(true);
    });
  });

  describe('mergeAmenities', () => {
    it('should merge primary and secondary amenities', () => {
      const primary = {
        has_parking: true,
        has_balcony: false,
        has_garage: false,
        is_furnished: false,
        additional: { elevator: true },
      };

      const secondary = {
        has_balcony: true,
        is_furnished: true,
        additional: { air_conditioning: true },
      };

      const result = mapper.mergeAmenities(primary, secondary);

      expect(result.has_parking).toBe(true); // From primary
      expect(result.has_balcony).toBe(true); // From secondary
      expect(result.has_garage).toBe(false);
      expect(result.is_furnished).toBe(true); // From secondary
      expect(result.additional.elevator).toBe(true); // From primary
      expect(result.additional.air_conditioning).toBe(true); // From secondary
    });

    it('should handle empty secondary', () => {
      const primary = {
        has_parking: true,
        has_balcony: true,
        has_garage: false,
        is_furnished: true,
        additional: {},
      };

      const result = mapper.mergeAmenities(primary, {});

      expect(result.has_parking).toBe(true);
      expect(result.has_balcony).toBe(true);
    });
  });
});
