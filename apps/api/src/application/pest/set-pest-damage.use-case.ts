import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestDamageInput {
  id: string; actor: string;
  symptoms?: Record<string, string>; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string;
}

export class SetPestDamageUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestDamageInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setDamage({
      symptoms: input.symptoms ? TranslatableText.create(input.symptoms) : undefined,
      attackedOrgans: input.attackedOrgans,
      damageTypes: input.damageTypes,
      harmfulnessLevel: input.harmfulnessLevel,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { damage: { symptoms: input.symptoms, attackedOrgans: input.attackedOrgans, damageTypes: input.damageTypes, harmfulnessLevel: input.harmfulnessLevel } },
    });
    return snap;
  }
}
