import { Body, Controller, Get, Param, Post, Patch, Delete, HttpCode, NotFoundException, ConflictException, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreatePestUseCase } from '../../application/pest/create-pest.use-case';
import { ListPestsUseCase } from '../../application/pest/list-pests.use-case';
import { UpdatePestUseCase, PestNotFoundError } from '../../application/pest/update-pest.use-case';
import { DeletePestUseCase, PestInUseError } from '../../application/pest/delete-pest.use-case';
import { PEST_REPOSITORY, PestRepository } from '../../application/pest/pest.repository';
import { toPestDocument } from '../../application/pest/pest-read-model';
import { PestType } from '../../domain/pest/pest-type';
import { STORAGE_PORT, StoragePort } from '../../application/media/storage.port';
import { toImageDto } from '../media/image-dto';
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';

@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('pests')
export class PestController {
  constructor(
    private readonly createPest: CreatePestUseCase,
    private readonly listPests: ListPestsUseCase,
    private readonly updatePest: UpdatePestUseCase,
    private readonly deletePest: DeletePestUseCase,
    @Inject(PEST_REPOSITORY) private readonly pests: PestRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: {
    name: Record<string, string>; type: PestType; scientificName?: string;
    symptoms?: Record<string, string>; images?: { key: string; caption?: string }[]; notes?: string;
  }) {
    const snap = await this.createPest.execute({ actor: user.email, ...body });
    return this.toResponse(snap);
  }

  @Get()
  async list() {
    return (await this.listPests.execute()).map((p) => this.toResponse(p));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.pests.findById(id);
    if (!snap) throw new NotFoundException(id);
    return this.toResponse(snap);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    name: Record<string, string>; type: PestType; scientificName?: string;
    images?: { key: string; caption?: string }[];
  }) {
    try {
      const snap = await this.updatePest.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try {
      await this.deletePest.execute({ id, actor: user.email });
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      if (e instanceof PestInUseError) throw new ConflictException({ message: `Rattaché à ${e.count} culture(s) — détachez-le d'abord.`, count: e.count });
      throw e;
    }
  }

  private toResponse(snap: PestDiseaseSnapshot) {
    const doc = toPestDocument(snap);
    return { ...doc, images: (snap.images ?? []).map((img) => toImageDto(img, this.storage)) };
  }
}
