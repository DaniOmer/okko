import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { ZoneRepository } from './zone.repository';

export class ListZonesUseCase {
  constructor(private readonly zones: ZoneRepository) {}
  async execute(): Promise<ZoneSnapshot[]> { return this.zones.list(); }
}
