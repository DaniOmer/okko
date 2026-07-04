import { Body, Controller, Get, Param, Patch, Post, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateCropUseCase } from '../../application/crop/create-crop.use-case';
import { UpdateCropUseCase } from '../../application/crop/update-crop.use-case';
import { PublishCropUseCase, CropNotFoundError } from '../../application/crop/publish-crop.use-case';
import { CropStatusError } from '../../domain/crop/crop-status';
import { CROP_REPOSITORY, CropRepository } from '../../application/crop/crop.repository';
import { toCropDocument } from '../../application/crop/crop-read-model';
import { CycleType } from '../../domain/crop/cycle-type';
import { SetCropRequirementsUseCase } from '../../application/crop/set-crop-requirements.use-case';
import { AddVarietyUseCase } from '../../application/crop/add-variety.use-case';
import { ListVarietiesUseCase } from '../../application/crop/list-varieties.use-case';
import { VARIETY_REPOSITORY, VarietyRepository } from '../../application/crop/variety.repository';
import { ClimaticRequirementsJSON } from '../../domain/shared/climatic-requirements';
import { EdaphicRequirementsJSON } from '../../domain/shared/edaphic-requirements';
import { RangeValue } from '../../domain/shared/range-value';

const ACTOR = 'admin'; // v1 : rôle unique, auth simple à ajouter plus tard

@Controller('crops')
export class CropController {
  constructor(
    private readonly createCrop: CreateCropUseCase,
    private readonly updateCrop: UpdateCropUseCase,
    private readonly publishCrop: PublishCropUseCase,
    @Inject(CROP_REPOSITORY) private readonly crops: CropRepository,
    private readonly setRequirements: SetCropRequirementsUseCase,
    private readonly addVariety: AddVarietyUseCase,
    private readonly listVarieties: ListVarietiesUseCase,
    @Inject(VARIETY_REPOSITORY) private readonly varieties: VarietyRepository,
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
    const vars = await this.varieties.listByCrop(id);
    return toCropDocument(snap, 'fr', vars);
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
      if (e instanceof CropStatusError) throw new ConflictException(e.message);
      throw e;
    }
  }

  @Patch(':id/requirements')
  async requirements(
    @Param('id') id: string,
    @Body() body: { climatic?: ClimaticRequirementsJSON; edaphic?: EdaphicRequirementsJSON },
  ) {
    try {
      const snap = await this.setRequirements.execute({ id, actor: ACTOR, ...body });
      const vars = await this.varieties.listByCrop(id);
      return toCropDocument(snap, 'fr', vars);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/varieties')
  async createVariety(
    @Param('id') id: string,
    @Body() body: { name: Record<string, string>; maturityDays?: number; yieldPotential?: ReturnType<RangeValue['toJSON']>; traits?: string[] },
  ) {
    try {
      return await this.addVariety.execute({ cropId: id, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Get(':id/varieties')
  async getVarieties(@Param('id') id: string) {
    return this.listVarieties.execute({ cropId: id });
  }
}
