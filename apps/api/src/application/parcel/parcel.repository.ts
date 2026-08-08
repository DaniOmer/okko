import { ParcelSnapshot } from '../../domain/parcel/parcel';

export const PARCEL_REPOSITORY = Symbol('PARCEL_REPOSITORY');

export interface ParcelRepository {
  save(p: ParcelSnapshot): Promise<void>;
  findById(id: string): Promise<ParcelSnapshot | null>;
  listByOrganization(organizationId: string): Promise<ParcelSnapshot[]>;
  delete(id: string): Promise<void>;
}
