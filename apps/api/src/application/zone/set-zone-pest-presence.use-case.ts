import { ZonePestPresence, ZonePestPresenceSnapshot } from '../../domain/zone/zone-pest-presence';
import { ZoneRepository } from './zone.repository';
import { ZonePestPresenceRepository } from './zone-pest-presence.repository';
import { PestRepository } from '../pest/pest.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { ZoneNotFoundError } from './update-zone.use-case';
import { PestNotFoundError } from '../pest/update-pest.use-case';

export interface SetZonePestPresenceInput { zoneId: string; pestId: string; frequency: string; actor: string; }

export class SetZonePestPresenceUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly pests: PestRepository,
    private readonly presences: ZonePestPresenceRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetZonePestPresenceInput): Promise<ZonePestPresenceSnapshot> {
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    if (!(await this.pests.findById(input.pestId))) throw new PestNotFoundError(input.pestId);
    const snap = ZonePestPresence.create({ zoneId: input.zoneId, pestId: input.pestId, frequency: input.frequency }).toSnapshot();
    await this.presences.save(snap);
    await this.audit.record({
      entityType: 'ZonePestPresence', entityId: `${input.zoneId}:${input.pestId}`,
      actor: input.actor, at: this.clock.nowIso(), changes: { set: snap },
    });
    return snap;
  }
}
