import { ZonePestPresenceRepository } from './zone-pest-presence.repository';
import { ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';

export class InMemoryZonePestPresenceRepository implements ZonePestPresenceRepository {
  private store: ZonePestPresenceSnapshot[] = [];
  async save(s: ZonePestPresenceSnapshot): Promise<void> {
    this.store = this.store.filter((x) => !(x.zoneId === s.zoneId && x.pestId === s.pestId)).concat(s);
  }
  async listByZone(zoneId: string): Promise<ZonePestPresenceSnapshot[]> {
    return this.store.filter((s) => s.zoneId === zoneId);
  }
  async listByPest(pestId: string): Promise<ZonePestPresenceSnapshot[]> {
    return this.store.filter((s) => s.pestId === pestId);
  }
  async delete(zoneId: string, pestId: string): Promise<void> {
    this.store = this.store.filter((x) => !(x.zoneId === zoneId && x.pestId === pestId));
  }
  async deleteByZone(zoneId: string): Promise<void> {
    this.store = this.store.filter((x) => x.zoneId !== zoneId);
  }
}
