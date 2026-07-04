import { PricePointSnapshot } from '../../domain/price/price-point';

export const PRICE_POINT_REPOSITORY = Symbol('PRICE_POINT_REPOSITORY');

export interface PricePointRepository {
  save(p: PricePointSnapshot): Promise<void>;
  listByCrop(cropId: string): Promise<PricePointSnapshot[]>;
}
