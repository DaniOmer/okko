import { Provenance, ProvenanceSource } from './provenance';

describe('Provenance', () => {
  it('crée une provenance manuelle validée', () => {
    const p = Provenance.manual('expert:omer');
    expect(p.source).toBe(ProvenanceSource.MANUAL);
    expect(p.validatedBy).toBe('expert:omer');
  });

  it('crée une provenance externe avec référence', () => {
    const p = Provenance.external({
      sourceRef: 'https://isda-africa.com',
      capturedAt: '2026-07-02',
      confidence: 'medium',
    });
    expect(p.source).toBe(ProvenanceSource.EXTERNAL);
    expect(p.sourceRef).toBe('https://isda-africa.com');
  });
});
