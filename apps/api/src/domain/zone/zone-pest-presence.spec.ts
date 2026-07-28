import { ZonePestPresence } from './zone-pest-presence';

describe('ZonePestPresence', () => {
  it('create expose zoneId/pestId/frequency dans le snapshot', () => {
    const s = ZonePestPresence.create({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT' }).toSnapshot();
    expect(s).toEqual({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT' });
  });
  it('fromSnapshot round-trip', () => {
    const s = { zoneId: 'z1', pestId: 'p1', frequency: 'ENDEMIC' };
    expect(ZonePestPresence.fromSnapshot(s).toSnapshot()).toEqual(s);
  });
});
