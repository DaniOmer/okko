import { Body, Controller, Get, Param, Post, NotFoundException, Inject } from '@nestjs/common';
import { CreateZoneUseCase } from '../../application/zone/create-zone.use-case';
import { ListZonesUseCase } from '../../application/zone/list-zones.use-case';
import { ZONE_REPOSITORY, ZoneRepository } from '../../application/zone/zone.repository';
import { toZoneDocument } from '../../application/zone/zone-read-model';
import { RangeValue } from '../../domain/shared/range-value';

const ACTOR = 'admin';

@Controller('zones')
export class ZoneController {
  constructor(
    private readonly createZone: CreateZoneUseCase,
    private readonly listZones: ListZonesUseCase,
    @Inject(ZONE_REPOSITORY) private readonly zones: ZoneRepository,
  ) {}

  @Post()
  async create(@Body() body: {
    name: Record<string, string>; country: string; koppen?: string;
    altitude?: ReturnType<RangeValue['toJSON']>; annualRainfall?: ReturnType<RangeValue['toJSON']>; notes?: string;
  }) {
    const snap = await this.createZone.execute({ actor: ACTOR, ...body });
    return toZoneDocument(snap);
  }

  @Get()
  async list() {
    return (await this.listZones.execute()).map((z) => toZoneDocument(z));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.zones.findById(id);
    if (!snap) throw new NotFoundException(id);
    return toZoneDocument(snap);
  }
}
