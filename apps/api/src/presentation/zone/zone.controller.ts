import { Body, Controller, Get, Param, Post, Patch, Delete, HttpCode, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { CreateZoneUseCase } from '../../application/zone/create-zone.use-case';
import { ListZonesUseCase } from '../../application/zone/list-zones.use-case';
import { UpdateZoneUseCase, ZoneNotFoundError } from '../../application/zone/update-zone.use-case';
import { DeleteZoneUseCase, ZoneInUseError } from '../../application/zone/delete-zone.use-case';
import { ZONE_REPOSITORY, ZoneRepository } from '../../application/zone/zone.repository';
import { toZoneDocument } from '../../application/zone/zone-read-model';
import { RangeValue } from '../../domain/shared/range-value';

const ACTOR = 'admin';

@Controller('zones')
export class ZoneController {
  constructor(
    private readonly createZone: CreateZoneUseCase,
    private readonly listZones: ListZonesUseCase,
    private readonly updateZone: UpdateZoneUseCase,
    private readonly deleteZone: DeleteZoneUseCase,
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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name: Record<string, string>; country: string; koppen?: string }) {
    try {
      const snap = await this.updateZone.execute({ id, actor: ACTOR, ...body });
      return toZoneDocument(snap);
    } catch (e) {
      if (e instanceof ZoneNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    try {
      await this.deleteZone.execute({ id, actor: ACTOR });
    } catch (e) {
      if (e instanceof ZoneNotFoundError) throw new NotFoundException(id);
      if (e instanceof ZoneInUseError) throw new ConflictException({ message: `Rattachée à ${e.count} culture(s) — détachez-la d'abord.`, count: e.count });
      throw e;
    }
  }
}
