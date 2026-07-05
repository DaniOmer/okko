import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

export const ZONE_REPOSITORY = Symbol('ZONE_REPOSITORY');

export interface ZoneRepository {
  save(z: ZoneSnapshot): Promise<void>;
  findById(id: string): Promise<ZoneSnapshot | null>;
  list(): Promise<ZoneSnapshot[]>;
  delete(id: string): Promise<void>;
}
