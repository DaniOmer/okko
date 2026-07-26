import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { MinMaxRangeJSON } from '../../domain/shared/min-max-range';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestWeedInput {
  id: string; actor: string;
  reproductionMode?: string[]; disseminationCapacity?: string;
  emergenceDepth?: MinMaxRangeJSON; seedBankLongevity?: MinMaxRangeJSON;
}

export class SetPestWeedUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestWeedInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setWeed({
      reproductionMode: input.reproductionMode,
      disseminationCapacity: input.disseminationCapacity,
      emergenceDepth: input.emergenceDepth,
      seedBankLongevity: input.seedBankLongevity,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { weed: { reproductionMode: input.reproductionMode, disseminationCapacity: input.disseminationCapacity, emergenceDepth: input.emergenceDepth, seedBankLongevity: input.seedBankLongevity } },
    });
    return snap;
  }
}
