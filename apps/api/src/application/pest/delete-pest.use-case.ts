import { PestRepository } from './pest.repository';
import { CropPestControlRepository } from './crop-pest-control.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { PestNotFoundError } from './update-pest.use-case';

export { PestNotFoundError };

export class PestInUseError extends Error {
  constructor(public readonly count: number) {
    super(`Ravageur référencé par ${count} culture(s)`);
    this.name = 'PestInUseError';
  }
}

export class DeletePestUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly links: CropPestControlRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<void> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const refs = await this.links.listByPest(input.id);
    if (refs.length > 0) throw new PestInUseError(refs.length);
    await this.pests.delete(input.id);
    await this.audit.record({
      entityType: 'Pest', entityId: input.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { deleted: { id: input.id } },
    });
  }
}
