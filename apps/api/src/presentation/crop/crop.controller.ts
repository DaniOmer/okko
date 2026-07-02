import { Body, Controller, Get, Param, Patch, Post, NotFoundException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateCropUseCase } from '../../application/crop/create-crop.use-case';
import { UpdateCropUseCase } from '../../application/crop/update-crop.use-case';
import { PublishCropUseCase, CropNotFoundError } from '../../application/crop/publish-crop.use-case';
import { CROP_REPOSITORY, CropRepository } from '../../application/crop/crop.repository';
import { toCropDocument } from '../../application/crop/crop-read-model';
import { CycleType } from '../../domain/crop/cycle-type';

const ACTOR = 'admin'; // v1 : rôle unique, auth simple à ajouter plus tard

@Controller('crops')
export class CropController {
  constructor(
    private readonly createCrop: CreateCropUseCase,
    private readonly updateCrop: UpdateCropUseCase,
    private readonly publishCrop: PublishCropUseCase,
    @Inject(CROP_REPOSITORY) private readonly crops: CropRepository,
  ) {}

  @Post()
  async create(@Body() body: { commonNames: Record<string, string>; scientificName: string; family: string; cycleType: CycleType }) {
    const snap = await this.createCrop.execute({ id: randomUUID(), actor: ACTOR, ...body });
    return toCropDocument(snap);
  }

  @Get()
  async list() {
    return (await this.crops.list()).map((s) => toCropDocument(s));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.crops.findById(id);
    if (!snap) throw new NotFoundException(id);
    return toCropDocument(snap);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { commonNames?: Record<string, string>; metadata?: Record<string, unknown> }) {
    try {
      const snap = await this.updateCrop.execute({ id, actor: ACTOR, ...body });
      return toCropDocument(snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    try {
      const snap = await this.publishCrop.execute({ id, actor: ACTOR });
      return toCropDocument(snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }
}
