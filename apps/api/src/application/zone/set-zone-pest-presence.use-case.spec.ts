import { SetZonePestPresenceUseCase } from './set-zone-pest-presence.use-case';
import { InMemoryZonePestPresenceRepository } from './in-memory-zone-pest-presence.repository';
import { ZoneNotFoundError } from './update-zone.use-case';
import { PestNotFoundError } from '../pest/update-pest.use-case';

const zoneRepo = (has: boolean) => ({ findById: async () => (has ? ({ id: 'z1' } as never) : null) } as never);
const pestRepo = (has: boolean) => ({ findById: async () => (has ? ({ id: 'p1' } as never) : null) } as never);
const audit = () => { const records: unknown[] = []; return { record: async (r: unknown) => { records.push(r); }, records } as never; };
const clock = { nowIso: () => '2026-07-28T00:00:00.000Z' } as never;

describe('SetZonePestPresenceUseCase', () => {
  it('zone inconnue → ZoneNotFoundError', async () => {
    const uc = new SetZonePestPresenceUseCase(zoneRepo(false), pestRepo(true), new InMemoryZonePestPresenceRepository(), audit(), clock);
    await expect(uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT', actor: 'a' })).rejects.toThrow(ZoneNotFoundError);
  });
  it('bioagresseur inconnu → PestNotFoundError', async () => {
    const uc = new SetZonePestPresenceUseCase(zoneRepo(true), pestRepo(false), new InMemoryZonePestPresenceRepository(), audit(), clock);
    await expect(uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'FREQUENT', actor: 'a' })).rejects.toThrow(PestNotFoundError);
  });
  it('set puis relecture + upsert de la fréquence', async () => {
    const presences = new InMemoryZonePestPresenceRepository();
    const uc = new SetZonePestPresenceUseCase(zoneRepo(true), pestRepo(true), presences, audit(), clock);
    await uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'OCCASIONAL', actor: 'a' });
    await uc.execute({ zoneId: 'z1', pestId: 'p1', frequency: 'ENDEMIC', actor: 'a' });
    expect(await presences.listByZone('z1')).toEqual([{ zoneId: 'z1', pestId: 'p1', frequency: 'ENDEMIC' }]);
  });
});
