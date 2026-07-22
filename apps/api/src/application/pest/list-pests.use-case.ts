import { PestSnapshot } from '../../domain/pest/pest';
import { PestRepository } from './pest.repository';

export class ListPestsUseCase {
  constructor(private readonly pests: PestRepository) {}
  async execute(): Promise<PestSnapshot[]> { return this.pests.list(); }
}
