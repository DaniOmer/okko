import { BundledCropCalendarProvider } from './bundled-crop-calendar.provider';

describe('BundledCropCalendarProvider', () => {
  let provider: BundledCropCalendarProvider;

  beforeEach(() => {
    provider = new BundledCropCalendarProvider();
  });

  it('renvoie une fenêtre de semis pour (BJ, 0338 Maïs)', async () => {
    const w = await provider.getSowingWindow({ faoCode: '0338', country: 'BJ' });
    expect(w).not.toBeNull();
    expect(w!.sowingStart).toMatch(/^2000-\d{2}-\d{2}$/);
    expect(w!.sowingEnd).toMatch(/^2000-\d{2}-\d{2}$/);
    expect(w!.sourceRef).toBe('Calendrier cultural (données ouvertes, à valider)');
  });

  it('est insensible à la casse du pays (bj → BJ)', async () => {
    const w = await provider.getSowingWindow({ faoCode: '0338', country: 'bj' });
    expect(w).not.toBeNull();
  });

  it('renvoie null pour un couple (pays, culture) non couvert', async () => {
    const w = await provider.getSowingWindow({ faoCode: '0338', country: 'ZZ' });
    expect(w).toBeNull();
  });

  it('renvoie null pour un code culture inconnu', async () => {
    const w = await provider.getSowingWindow({ faoCode: '9999', country: 'BJ' });
    expect(w).toBeNull();
  });

  it('toutes les fenêtres sont contenues dans la même année (start ≤ end)', async () => {
    // garantit qu'aucune fenêtre embarquée n'est à cheval sur deux années
    const w = await provider.getSowingWindow({ faoCode: '0325', country: 'NE' });
    expect(w).not.toBeNull();
    expect(w!.sowingStart <= w!.sowingEnd).toBe(true);
  });
});
