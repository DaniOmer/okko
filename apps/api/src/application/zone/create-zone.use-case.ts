import { AgroEcologicalZone, ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { MediaImage, MediaImageJSON } from '../../domain/media/media-image';
import { ZoneRepository } from './zone.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateZoneInput {
  id?: string;
  name: Record<string, string>;
  country: string;
  koppen?: string;
  altitude?: ReturnType<RangeValue['toJSON']>;
  annualRainfall?: ReturnType<RangeValue['toJSON']>;
  notes?: string;
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

export class CreateZoneUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateZoneInput): Promise<ZoneSnapshot> {
    const zone = AgroEcologicalZone.create({
      id: input.id ?? this.ids.next(),
      name: TranslatableText.create(input.name),
      country: input.country,
      koppen: input.koppen,
      altitude: input.altitude ? RangeValue.create(input.altitude) : undefined,
      annualRainfall: input.annualRainfall ? RangeValue.create(input.annualRainfall) : undefined,
      notes: input.notes,
      images: input.images,
      code: input.code,
      region: input.region,
      description: input.description ? TranslatableText.create(input.description) : undefined,
      climateType: input.climateType,
      meanTemperature: input.meanTemperature,
      meanHumidity: input.meanHumidity,
      rainySeasonStart: input.rainySeasonStart,
      rainySeasonEnd: input.rainySeasonEnd,
      drySeasonStart: input.drySeasonStart,
      drySeasonEnd: input.drySeasonEnd,
      soilTypes: input.soilTypes,
      fertility: input.fertility,
      drainage: input.drainage,
    });
    const snap = zone.toSnapshot();
    await this.zones.save(snap);
    await this.audit.record({
      entityType: 'AgroEcologicalZone', entityId: zone.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
