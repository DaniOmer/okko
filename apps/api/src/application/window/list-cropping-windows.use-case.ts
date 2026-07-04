import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { CroppingWindowRepository } from './cropping-window.repository';

export class ListCroppingWindowsUseCase {
  constructor(private readonly windows: CroppingWindowRepository) {}
  async execute(input: { cropId: string }): Promise<CroppingWindowSnapshot[]> {
    return this.windows.listByCrop(input.cropId);
  }
}
