import { CropRepository } from '../crop/crop.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';

export interface ZoneCropView {
  cropId: string;
  cropName: Record<string, string>;
  rating: string;
  justification?: string;
}

export class ListZoneCropsUseCase {
  constructor(
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly crops: CropRepository,
  ) {}

  async execute(input: { zoneId: string }): Promise<ZoneCropView[]> {
    const suits = await this.suitabilities.listByZone(input.zoneId);
    const views: ZoneCropView[] = [];
    for (const s of suits) {
      const crop = await this.crops.findById(s.cropId);
      views.push({
        cropId: s.cropId,
        cropName: crop ? crop.commonNames : { fr: s.cropId },
        rating: s.rating,
        justification: s.justification,
      });
    }
    return views;
  }
}
