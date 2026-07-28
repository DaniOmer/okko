import { ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';

export const ZONE_PEST_PRESENCE_REPOSITORY = Symbol('ZONE_PEST_PRESENCE_REPOSITORY');

export interface ZonePestPresenceRepository {
  save(s: ZonePestPresenceSnapshot): Promise<void>;
  listByZone(zoneId: string): Promise<ZonePestPresenceSnapshot[]>;
  listByPest(pestId: string): Promise<ZonePestPresenceSnapshot[]>;
  delete(zoneId: string, pestId: string): Promise<void>;
  deleteByZone(zoneId: string): Promise<void>;
}
