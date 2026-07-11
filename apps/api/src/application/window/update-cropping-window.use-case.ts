import { CroppingWindow, CroppingWindowSnapshot } from '../../domain/window/cropping-window';
import { TechnicalOperation, TechnicalOperationJSON } from '../../domain/window/technical-operation';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { ZoneRepository } from '../zone/zone.repository';
import { CroppingWindowRepository } from './cropping-window.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';

export class CroppingWindowNotFoundError extends Error {
  constructor(id: string) { super(`Cropping window not found: ${id}`); this.name = 'CroppingWindowNotFoundError'; }
}

export interface UpdateCroppingWindowInput {
  cropId: string; windowId: string; zoneId: string; season: string;
  sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean;
  operations?: TechnicalOperationJSON[]; notes?: string; actor: string;
}

export class UpdateCroppingWindowUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly zones: ZoneRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateCroppingWindowInput): Promise<CroppingWindowSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const crop = Crop.fromEvents(stored);
    if (!crop.windows.some((w) => w.id === input.windowId)) throw new CroppingWindowNotFoundError(input.windowId);
    const window = CroppingWindow.create({
      id: input.windowId, cropId: input.cropId, zoneId: input.zoneId, season: input.season,
      sowingStart: input.sowingStart, sowingEnd: input.sowingEnd,
      irrigationRequired: input.irrigationRequired,
      operations: (input.operations ?? []).map((j) => TechnicalOperation.fromJSON(j)),
      notes: input.notes,
    });
    const snap = window.toSnapshot();
    crop.updateCroppingWindow(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.windows.save(snap); // upsert par id
    await this.audit.record({ entityType: 'CroppingWindow', entityId: input.windowId, actor: input.actor, at, changes: { updated: snap } });
    return snap;
  }
}
