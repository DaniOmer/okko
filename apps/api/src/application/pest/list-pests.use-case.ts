import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { PestRepository } from './pest.repository';

export class ListPestsUseCase {
  constructor(private readonly pests: PestRepository) {}
  async execute(): Promise<PestDiseaseSnapshot[]> { return this.pests.list(); }
}
