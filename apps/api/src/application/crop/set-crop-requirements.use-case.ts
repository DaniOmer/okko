import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { ClimaticRequirements, ClimaticRequirementsJSON } from '../../domain/shared/climatic-requirements';
import { EdaphicRequirements, EdaphicRequirementsJSON } from '../../domain/shared/edaphic-requirements';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropRequirementsInput {
  id: string;
  climatic?: ClimaticRequirementsJSON;
  edaphic?: EdaphicRequirementsJSON;
  actor: string;
}

export class SetCropRequirementsUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * Full-replace semantics: a provided block replaces that requirement block entirely;
   * an omitted block is left unchanged.
   */
  async execute(input: SetCropRequirementsInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.id);
    if (!snap) throw new CropNotFoundError(input.id);
    const crop = Crop.fromSnapshot(snap);
    if (input.climatic) crop.setClimaticRequirements(ClimaticRequirements.fromJSON(input.climatic));
    if (input.edaphic) crop.setEdaphicRequirements(EdaphicRequirements.fromJSON(input.edaphic));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { from: { climatic: snap.climatic, edaphic: snap.edaphic }, to: { climatic: next.climatic, edaphic: next.edaphic } },
    });
    return next;
  }
}
