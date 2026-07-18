import { Variety, VarietySnapshot, VarietyDiseaseResistance, VarietyZoneAdaptation } from '../../domain/crop/variety';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from './crop-event-store';
import { VarietyRepository } from './variety.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export class VarietyNotFoundError extends Error {
  constructor(id: string) { super(`Variety not found: ${id}`); this.name = 'VarietyNotFoundError'; }
}

export interface UpdateVarietyInput {
  cropId: string; varietyId: string; name: Record<string, string>;
  maturityDays?: number; yieldPotential?: ReturnType<RangeValue['toJSON']>; traits?: string[];
  diseaseResistances?: VarietyDiseaseResistance[]; zoneAdaptations?: VarietyZoneAdaptation[];
  actor: string;
}

export class UpdateVarietyUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly varieties: VarietyRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateVarietyInput): Promise<VarietySnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.varieties.some((v) => v.id === input.varietyId)) throw new VarietyNotFoundError(input.varietyId);
    const variety = Variety.create({
      id: input.varietyId,
      cropId: input.cropId,
      name: TranslatableText.create(input.name),
      maturityDays: input.maturityDays,
      yieldPotential: input.yieldPotential ? RangeValue.create(input.yieldPotential) : undefined,
      traits: input.traits,
      diseaseResistances: input.diseaseResistances,
      zoneAdaptations: input.zoneAdaptations,
    });
    const snap = variety.toSnapshot();
    crop.updateVariety(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.varieties.save(snap); // upsert par id (Prisma variety.upsert)
    await this.audit.record({ entityType: 'Variety', entityId: input.varietyId, actor: input.actor, at, changes: { updated: snap } });
    return snap;
  }
}
