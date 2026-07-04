import { CropZoneSuitability } from './crop-zone-suitability';
import { SuitabilityRating } from './suitability-rating';
import { Provenance, ProvenanceSource } from '../shared/provenance';

describe('CropZoneSuitability', () => {
  const base = () => CropZoneSuitability.create({
    cropId: 'crop-1',
    zoneId: 'zone-1',
    rating: SuitabilityRating.SUITABLE,
    justification: 'Pluviométrie et sol adaptés',
  });

  it('exposes its attributes', () => {
    const s = base();
    expect(s.cropId).toBe('crop-1');
    expect(s.zoneId).toBe('zone-1');
    expect(s.rating).toBe(SuitabilityRating.SUITABLE);
    expect(s.justification).toBe('Pluviométrie et sol adaptés');
  });

  it('round-trips through snapshot', () => {
    const restored = CropZoneSuitability.fromSnapshot(base().toSnapshot());
    expect(restored.rating).toBe(SuitabilityRating.SUITABLE);
    expect(restored.justification).toBe('Pluviométrie et sol adaptés');
  });

  it('round-trips provenance through snapshot', () => {
    const s = CropZoneSuitability.create({
      cropId: 'crop-1',
      zoneId: 'zone-1',
      rating: SuitabilityRating.MARGINAL,
      provenance: Provenance.external({ sourceRef: 'GAEZ', capturedAt: '2026-07-04' }),
    });
    const restored = CropZoneSuitability.fromSnapshot(s.toSnapshot());
    expect(restored.provenance?.sourceRef).toBe('GAEZ');
    expect(restored.provenance?.source).toBe(ProvenanceSource.EXTERNAL);
  });
});
