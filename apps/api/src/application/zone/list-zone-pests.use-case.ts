import { PestRepository } from '../pest/pest.repository';
import { ZonePestPresenceRepository } from './zone-pest-presence.repository';

export interface ZonePestView {
  pestId: string;
  pestName: Record<string, string>;
  kind: string;
  frequency: string;
}

export class ListZonePestsUseCase {
  constructor(
    private readonly presences: ZonePestPresenceRepository,
    private readonly pests: PestRepository,
  ) {}

  async execute(input: { zoneId: string }): Promise<ZonePestView[]> {
    const links = await this.presences.listByZone(input.zoneId);
    const views: ZonePestView[] = [];
    for (const l of links) {
      const pest = await this.pests.findById(l.pestId);
      views.push({
        pestId: l.pestId,
        pestName: pest ? pest.name : { fr: l.pestId },
        kind: pest ? pest.kind : 'ANIMAL',
        frequency: l.frequency,
      });
    }
    return views;
  }
}
