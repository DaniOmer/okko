import { SuitabilityRating } from '../../domain/zone/suitability-rating';
import { ZoneRepository } from './zone.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';

export interface CropZoneView {
  zoneId: string;
  zoneName: Record<string, string>;
  rating: SuitabilityRating;
  justification?: string;
}

export class ListCropZonesUseCase {
  constructor(
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly zones: ZoneRepository,
  ) {}

  async execute(input: { cropId: string }): Promise<CropZoneView[]> {
    const suits = await this.suitabilities.listByCrop(input.cropId);
    const views: CropZoneView[] = [];
    for (const s of suits) {
      const zone = await this.zones.findById(s.zoneId);
      views.push({
        zoneId: s.zoneId,
        zoneName: zone ? zone.name : { fr: s.zoneId },
        rating: s.rating,
        justification: s.justification,
      });
    }
    return views;
  }
}
