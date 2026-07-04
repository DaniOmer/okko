import { PestType } from '../../domain/pest/pest-type';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';
import { PestRepository } from './pest.repository';
import { CropPestControlRepository } from './crop-pest-control.repository';

export interface CropPestView {
  pestId: string;
  pestName: Record<string, string>;
  type: PestType;
  susceptibility: SusceptibilityLevel;
  controlMethods: CropPestControlSnapshot['controlMethods'];
}

export class ListCropPestsUseCase {
  constructor(
    private readonly controls: CropPestControlRepository,
    private readonly pests: PestRepository,
  ) {}

  async execute(input: { cropId: string }): Promise<CropPestView[]> {
    const controls = await this.controls.listByCrop(input.cropId);
    const views: CropPestView[] = [];
    for (const c of controls) {
      const pest = await this.pests.findById(c.pestId);
      views.push({
        pestId: c.pestId,
        pestName: pest ? pest.name : { fr: c.pestId },
        type: pest ? pest.type : PestType.OTHER,
        susceptibility: c.susceptibility,
        controlMethods: c.controlMethods,
      });
    }
    return views;
  }
}
