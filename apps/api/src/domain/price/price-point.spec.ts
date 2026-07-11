import { PricePoint } from './price-point';

describe('PricePoint', () => {
  const base = () => PricePoint.create({
    id: 'pp-1', cropId: 'crop-1', market: 'Dantokpa', periodStart: '2026-06-15', periodEnd: '2026-06-15',
    price: 350, unit: 'FCFA/kg', currency: 'XOF',
  });

  it('exposes its attributes', () => {
    const p = base();
    expect(p.cropId).toBe('crop-1');
    expect(p.market).toBe('Dantokpa');
    expect(p.periodStart).toBe('2026-06-15');
    expect(p.periodEnd).toBe('2026-06-15');
    expect(p.price).toBe(350);
    expect(p.unit).toBe('FCFA/kg');
    expect(p.currency).toBe('XOF');
  });

  it('round-trips through snapshot', () => {
    const restored = PricePoint.fromSnapshot(base().toSnapshot());
    expect(restored.market).toBe('Dantokpa');
    expect(restored.price).toBe(350);
  });
});
