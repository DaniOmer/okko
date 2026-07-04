import { AgroEcologicalZone, ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { ZoneRepository } from './zone.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../crop/add-variety.use-case';

export interface CreateZoneInput {
  id?: string;
  name: Record<string, string>;
  country: string;
  koppen?: string;
  altitude?: ReturnType<RangeValue['toJSON']>;
  annualRainfall?: ReturnType<RangeValue['toJSON']>;
  notes?: string;
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
