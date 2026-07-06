import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { ClimaticRequirements, ClimaticRequirementsJSON } from '../../domain/shared/climatic-requirements';
import { EdaphicRequirements, EdaphicRequirementsJSON } from '../../domain/shared/edaphic-requirements';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropRequirementsInput {
  id: string;
  climatic?: ClimaticRequirementsJSON;
  edaphic?: EdaphicRequirementsJSON;
  actor: string;
}

export class SetCropRequirementsUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * Full-replace semantics: a provided block replaces that requirement block entirely;
   * an omitted block is left unchanged.
   */
  async execute(input: SetCropRequirementsInput): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    const before = crop.toSnapshot();
    if (input.climatic) crop.setClimaticRequirements(ClimaticRequirements.fromJSON(input.climatic));
    if (input.edaphic) crop.setEdaphicRequirements(EdaphicRequirements.fromJSON(input.edaphic));
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor, at,
      changes: { from: { climatic: before.climatic, edaphic: before.edaphic }, to: { climatic: next.climatic, edaphic: next.edaphic } },
    });
    return next;
  }
}
