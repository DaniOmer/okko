import { Body, Controller, Get, Param, Post, Patch, Delete, HttpCode, NotFoundException, ConflictException, Inject, UseGuards } from '@nestjs/common';
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

@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('zones')
export class ZoneController {
  constructor(
    private readonly createZone: CreateZoneUseCase,
    private readonly listZones: ListZonesUseCase,
    private readonly updateZone: UpdateZoneUseCase,
    private readonly deleteZone: DeleteZoneUseCase,
    @Inject(ZONE_REPOSITORY) private readonly zones: ZoneRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: {
    name: Record<string, string>; country: string; koppen?: string;
    altitude?: ReturnType<RangeValue['toJSON']>; annualRainfall?: ReturnType<RangeValue['toJSON']>; notes?: string;
    images?: { key: string; caption?: string }[];
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
    images?: { key: string; caption?: string }[];
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

  private toResponse(snap: ZoneSnapshot) {
    const doc = toZoneDocument(snap);
    return { ...doc, images: (snap.images ?? []).map((img) => toImageDto(img, this.storage)) };
  }
}
