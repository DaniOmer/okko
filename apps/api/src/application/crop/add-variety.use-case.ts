import { Variety, VarietySnapshot } from '../../domain/crop/variety';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { RangeValue } from '../../domain/shared/range-value';
import { CropRepository } from './crop.repository';
import { VarietyRepository } from './variety.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';
import { IdGenerator } from '../shared/id-generator';

export interface AddVarietyInput {
  cropId: string;
  id?: string;
  name: Record<string, string>;
  maturityDays?: number;
  yieldPotential?: ReturnType<RangeValue['toJSON']>;
  traits?: string[];
  actor: string;
}

export class AddVarietyUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly varieties: VarietyRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddVarietyInput): Promise<VarietySnapshot> {
    const crop = await this.crops.findById(input.cropId);
    if (!crop) throw new CropNotFoundError(input.cropId);
    const variety = Variety.create({
      id: input.id ?? this.ids.next(),
      cropId: input.cropId,
      name: TranslatableText.create(input.name),
      maturityDays: input.maturityDays,
      yieldPotential: input.yieldPotential ? RangeValue.create(input.yieldPotential) : undefined,
      traits: input.traits,
    });
    const snap = variety.toSnapshot();
    await this.varieties.save(snap);
    await this.audit.record({
      entityType: 'Variety', entityId: variety.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
