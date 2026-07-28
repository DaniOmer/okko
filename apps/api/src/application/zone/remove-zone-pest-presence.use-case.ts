import { ZonePestPresenceRepository } from './zone-pest-presence.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface RemoveZonePestPresenceInput { zoneId: string; pestId: string; actor: string; }

export class RemoveZonePestPresenceUseCase {
  constructor(
    private readonly presences: ZonePestPresenceRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveZonePestPresenceInput): Promise<void> {
    await this.presences.delete(input.zoneId, input.pestId);
    await this.audit.record({
      entityType: 'ZonePestPresence', entityId: `${input.zoneId}:${input.pestId}`,
      actor: input.actor, at: this.clock.nowIso(), changes: { removed: { zoneId: input.zoneId, pestId: input.pestId } },
    });
  }
}
