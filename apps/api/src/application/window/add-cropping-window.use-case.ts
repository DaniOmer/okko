import { CroppingWindow, CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { TechnicalOperation, TechnicalOperationJSON } from '../../domain/window/technical-operation';
import { CropRepository } from '../crop/crop.repository';
import { ZoneRepository } from '../zone/zone.repository';
import { CroppingWindowRepository } from './cropping-window.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../crop/add-variety.use-case';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';

export interface AddCroppingWindowInput {
  cropId: string;
  zoneId: string;
  id?: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired?: boolean;
  operations?: TechnicalOperationJSON[];
  notes?: string;
  actor: string;
}

export class AddCroppingWindowUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly zones: ZoneRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddCroppingWindowInput): Promise<CroppingWindowSnapshot> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const window = CroppingWindow.create({
      id: input.id ?? this.ids.next(),
      cropId: input.cropId, zoneId: input.zoneId, season: input.season,
      sowingStart: input.sowingStart, sowingEnd: input.sowingEnd,
      irrigationRequired: input.irrigationRequired,
      operations: (input.operations ?? []).map((j) => TechnicalOperation.fromJSON(j)),
      notes: input.notes,
    });
    const snap = window.toSnapshot();
    await this.windows.save(snap);
    await this.audit.record({
      entityType: 'CroppingWindow', entityId: window.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
