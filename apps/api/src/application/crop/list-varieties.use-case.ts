import { VarietySnapshot } from '../../domain/crop/variety';
import { VarietyRepository } from './variety.repository';

export class ListVarietiesUseCase {
  constructor(private readonly varieties: VarietyRepository) {}

  async execute(input: { cropId: string }): Promise<VarietySnapshot[]> {
    return this.varieties.listByCrop(input.cropId);
  }
}
