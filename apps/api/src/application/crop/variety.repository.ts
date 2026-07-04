import { VarietySnapshot } from '../../domain/crop/variety';

export const VARIETY_REPOSITORY = Symbol('VARIETY_REPOSITORY');

export interface VarietyRepository {
  save(v: VarietySnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<VarietySnapshot[]>;
}
