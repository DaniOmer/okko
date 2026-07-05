import { ZoneRepository } from './zone.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { ZoneNotFoundError } from './update-zone.use-case';

export { ZoneNotFoundError };

export class ZoneInUseError extends Error {
  constructor(public readonly count: number) {
    super(`Zone référencée par ${count} culture(s)`);
    this.name = 'ZoneInUseError';
  }
}

export class DeleteZoneUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly links: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<void> {
    const existing = await this.zones.findById(input.id);
    if (!existing) throw new ZoneNotFoundError(input.id);
    const refs = await this.links.listByZone(input.id);
    if (refs.length > 0) throw new ZoneInUseError(refs.length);
    await this.zones.delete(input.id);
    await this.audit.record({
      entityType: 'AgroEcologicalZone', entityId: input.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { deleted: { id: input.id } },
    });
  }
}
