import { AgroEcologicalZone, ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { MediaImageJSON } from '../../domain/media/media-image';
import { ZoneRepository } from './zone.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export class ZoneNotFoundError extends Error {
  constructor(id: string) { super(`Zone not found: ${id}`); this.name = 'ZoneNotFoundError'; }
}

export interface UpdateZoneInput {
  id: string;
  name: Record<string, string>;
  country: string;
  koppen?: string;
  altitude?: ReturnType<RangeValue['toJSON']>;
  annualRainfall?: ReturnType<RangeValue['toJSON']>;
  images?: MediaImageJSON[];
  code?: string;
  region?: string;
  description?: Record<string, string>;
  climateType?: string;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  actor: string;
}

export class UpdateZoneUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateZoneInput): Promise<ZoneSnapshot> {
    const existing = await this.zones.findById(input.id);
    if (!existing) throw new ZoneNotFoundError(input.id);
    const updated = AgroEcologicalZone.fromSnapshot(existing).update({
      name: TranslatableText.create(input.name),
      country: input.country,
      code: input.code || undefined,
      region: input.region || undefined,
      description: input.description ? TranslatableText.create(input.description) : undefined,
      climateType: input.climateType || undefined,
      koppen: input.koppen || undefined,
      altitude: input.altitude ? RangeValue.create(input.altitude) : undefined,
      annualRainfall: input.annualRainfall ? RangeValue.create(input.annualRainfall) : undefined,
      meanTemperature: input.meanTemperature,
      meanHumidity: input.meanHumidity,
      rainySeasonStart: input.rainySeasonStart || undefined,
      rainySeasonEnd: input.rainySeasonEnd || undefined,
      drySeasonStart: input.drySeasonStart || undefined,
      drySeasonEnd: input.drySeasonEnd || undefined,
      soilTypes: input.soilTypes,
      fertility: input.fertility || undefined,
      drainage: input.drainage || undefined,
      images: input.images,
    });
    const snap = updated.toSnapshot();
    await this.zones.save(snap);
    await this.audit.record({
      entityType: 'AgroEcologicalZone', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { updated: snap },
    });
    return snap;
  }
}
