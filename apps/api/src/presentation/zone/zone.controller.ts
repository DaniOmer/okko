import { Body, Controller, Get, Param, Post, Patch, Put, Delete, HttpCode, NotFoundException, ConflictException, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateZoneUseCase } from '../../application/zone/create-zone.use-case';
import { ListZonesUseCase } from '../../application/zone/list-zones.use-case';
import { UpdateZoneUseCase, ZoneNotFoundError } from '../../application/zone/update-zone.use-case';
import { DeleteZoneUseCase, ZoneInUseError } from '../../application/zone/delete-zone.use-case';
import { ZONE_REPOSITORY, ZoneRepository } from '../../application/zone/zone.repository';
import { toZoneDocument } from '../../application/zone/zone-read-model';
import { RangeValue } from '../../domain/shared/range-value';
import { STORAGE_PORT, StoragePort } from '../../application/media/storage.port';
import { toImageDto } from '../media/image-dto';
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { SetZonePestPresenceUseCase } from '../../application/zone/set-zone-pest-presence.use-case';
import { RemoveZonePestPresenceUseCase } from '../../application/zone/remove-zone-pest-presence.use-case';
import { ListZonePestsUseCase } from '../../application/zone/list-zone-pests.use-case';
import { ListZoneCropsUseCase } from '../../application/zone/list-zone-crops.use-case';
import { PestNotFoundError } from '../../application/pest/update-pest.use-case';

@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('zones')
export class ZoneController {
  constructor(
    private readonly createZone: CreateZoneUseCase,
    private readonly listZones: ListZonesUseCase,
    private readonly updateZone: UpdateZoneUseCase,
    private readonly deleteZone: DeleteZoneUseCase,
    private readonly setZonePest: SetZonePestPresenceUseCase,
    private readonly removeZonePest: RemoveZonePestPresenceUseCase,
    private readonly listZonePests: ListZonePestsUseCase,
    private readonly listZoneCrops: ListZoneCropsUseCase,
    @Inject(ZONE_REPOSITORY) private readonly zones: ZoneRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: {
    name: Record<string, string>; country: string; koppen?: string;
    altitude?: ReturnType<RangeValue['toJSON']>; annualRainfall?: ReturnType<RangeValue['toJSON']>; notes?: string;
    images?: { key: string; caption?: string }[];
    code?: string; region?: string; description?: Record<string, string>;
    climateType?: string; meanTemperature?: number; meanHumidity?: number;
    rainySeasonStart?: string; rainySeasonEnd?: string; drySeasonStart?: string; drySeasonEnd?: string;
    soilTypes?: string[]; fertility?: string; drainage?: string;
  }) {
    const snap = await this.createZone.execute({ actor: user.email, ...body });
    return this.toResponse(snap);
  }

  @Get()
  async list() {
    return (await this.listZones.execute()).map((z) => this.toResponse(z));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.zones.findById(id);
    if (!snap) throw new NotFoundException(id);
    return this.toResponse(snap);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    name: Record<string, string>; country: string; koppen?: string;
    altitude?: ReturnType<RangeValue['toJSON']>; annualRainfall?: ReturnType<RangeValue['toJSON']>;
    images?: { key: string; caption?: string }[];
    code?: string; region?: string; description?: Record<string, string>;
    climateType?: string; meanTemperature?: number; meanHumidity?: number;
    rainySeasonStart?: string; rainySeasonEnd?: string; drySeasonStart?: string; drySeasonEnd?: string;
    soilTypes?: string[]; fertility?: string; drainage?: string;
  }) {
    try {
      const snap = await this.updateZone.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof ZoneNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try {
      await this.deleteZone.execute({ id, actor: user.email });
    } catch (e) {
      if (e instanceof ZoneNotFoundError) throw new NotFoundException(id);
      if (e instanceof ZoneInUseError) throw new ConflictException({ message: `Rattachée à ${e.count} culture(s) — détachez-la d'abord.`, count: e.count });
      throw e;
    }
  }

  @Get(':id/crops')
  async crops(@Param('id') id: string) {
    return this.listZoneCrops.execute({ zoneId: id });
  }

  @Get(':id/pests')
  async pests(@Param('id') id: string) {
    return this.listZonePests.execute({ zoneId: id });
  }

  @Put(':id/pests/:pestId')
  async setPest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pestId') pestId: string, @Body() body: { frequency: string }) {
    try {
      return await this.setZonePest.execute({ zoneId: id, pestId, frequency: body.frequency, actor: user.email });
    } catch (e) {
      if (e instanceof ZoneNotFoundError || e instanceof PestNotFoundError) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }

  @Delete(':id/pests/:pestId')
  @HttpCode(204)
  async removePest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pestId') pestId: string) {
    await this.removeZonePest.execute({ zoneId: id, pestId, actor: user.email });
  }

  private toResponse(snap: ZoneSnapshot) {
    const doc = toZoneDocument(snap);
    return { ...doc, images: (snap.images ?? []).map((img) => toImageDto(img, this.storage)) };
  }
}
