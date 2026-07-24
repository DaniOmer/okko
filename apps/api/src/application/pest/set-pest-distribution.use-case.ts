import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestDistributionInput {
  id: string; actor: string;
  geographicAreas?: string[]; favorableClimate?: Record<string, string>; knownPresence?: Record<string, string>;
}

export class SetPestDistributionUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestDistributionInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setDistribution({
      geographicAreas: input.geographicAreas,
      favorableClimate: input.favorableClimate ? TranslatableText.create(input.favorableClimate) : undefined,
      knownPresence: input.knownPresence ? TranslatableText.create(input.knownPresence) : undefined,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { distribution: { geographicAreas: input.geographicAreas, favorableClimate: input.favorableClimate, knownPresence: input.knownPresence } },
    });
    return snap;
  }
}
