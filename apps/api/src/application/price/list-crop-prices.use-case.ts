import { PricePointSnapshot } from '../../domain/price/price-point';
import { PricePointRepository } from './price-point.repository';

export class ListCropPricesUseCase {
  constructor(private readonly prices: PricePointRepository) {}
  async execute(input: { cropId: string }): Promise<PricePointSnapshot[]> {
    return this.prices.listByCrop(input.cropId);
  }
}
