import { CropCalendarProvider, SowingWindowSuggestion } from './crop-calendar-provider';
import { ZoneRepository } from '../zone/zone.repository';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';

export class SuggestSowingWindowUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly provider: CropCalendarProvider,
  ) {}

  async execute(input: { faoCode: string; zoneId: string }): Promise<SowingWindowSuggestion | null> {
    const zone = await this.zones.findById(input.zoneId);
    if (!zone) throw new ZoneNotFoundError(input.zoneId);
    return this.provider.getSowingWindow({ faoCode: input.faoCode, country: zone.country });
  }
}
