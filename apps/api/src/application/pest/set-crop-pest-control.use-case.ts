import { CropPestControl, CropPestControlSnapshot } from '../../domain/pest/crop-pest-control';
import { ControlMethod, ControlMethodJSON } from '../../domain/pest/control-method';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { Provenance, ProvenanceProps } from '../../domain/shared/provenance';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { PestRepository } from './pest.repository';
import { CropPestControlRepository } from './crop-pest-control.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class PestNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'PestNotFoundError';
  }
}

export interface SetCropPestControlInput {
  cropId: string;
  pestId: string;
  susceptibility: SusceptibilityLevel;
  sensitiveStages?: string[];
  threshold?: string;
  controlMethods?: ControlMethodJSON[];
  provenance?: ProvenanceProps;
  actor: string;
}

export class SetCropPestControlUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly pests: PestRepository,
    private readonly controls: CropPestControlRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropPestControlInput): Promise<CropPestControlSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    if (!(await this.pests.findById(input.pestId))) throw new PestNotFoundError(input.pestId);
    const provenance = input.provenance
      ? Provenance.fromJSON(input.provenance)
      : Provenance.manual(input.actor, this.clock.nowIso());
    const control = CropPestControl.create({
      cropId: input.cropId, pestId: input.pestId, susceptibility: input.susceptibility,
      sensitiveStages: input.sensitiveStages, threshold: input.threshold,
      controlMethods: (input.controlMethods ?? []).map((j) => ControlMethod.fromJSON(j)),
      provenance,
    });
    const snap = control.toSnapshot();
    const crop = Crop.fromEvents(stored);
    crop.setPestControl(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.controls.save(snap);
    await this.audit.record({
      entityType: 'CropPestControl', entityId: `${input.cropId}:${input.pestId}`,
      actor: input.actor, at, changes: { set: snap },
    });
    return snap;
  }
}
