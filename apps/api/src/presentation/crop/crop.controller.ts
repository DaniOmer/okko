import { Body, Controller, Get, Param, Patch, Post, Put, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateCropUseCase } from '../../application/crop/create-crop.use-case';
import { UpdateCropUseCase } from '../../application/crop/update-crop.use-case';
import { PublishCropUseCase, CropNotFoundError } from '../../application/crop/publish-crop.use-case';
import { CropStatusError } from '../../domain/crop/crop-status';
import { CROP_REPOSITORY, CropRepository } from '../../application/crop/crop.repository';
import { toCropDocument } from '../../application/crop/crop-read-model';
import { CropSnapshot } from '../../domain/crop/crop';
import { CycleType } from '../../domain/crop/cycle-type';
import { SetCropRequirementsUseCase } from '../../application/crop/set-crop-requirements.use-case';
import { AddVarietyUseCase } from '../../application/crop/add-variety.use-case';
import { ListVarietiesUseCase } from '../../application/crop/list-varieties.use-case';
import { VARIETY_REPOSITORY, VarietyRepository } from '../../application/crop/variety.repository';
import { ClimaticRequirementsJSON } from '../../domain/shared/climatic-requirements';
import { EdaphicRequirementsJSON } from '../../domain/shared/edaphic-requirements';
import { RangeValue } from '../../domain/shared/range-value';
import { SetCropZoneSuitabilityUseCase, ZoneNotFoundError } from '../../application/zone/set-crop-zone-suitability.use-case';
import { ListCropZonesUseCase } from '../../application/zone/list-crop-zones.use-case';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';
import { ProvenanceProps } from '../../domain/shared/provenance';
import { SetCropPhenologyUseCase } from '../../application/crop/set-crop-phenology.use-case';
import { AddCroppingWindowUseCase } from '../../application/window/add-cropping-window.use-case';
import { ListCroppingWindowsUseCase } from '../../application/window/list-cropping-windows.use-case';
import { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { TechnicalOperationJSON } from '../../domain/window/technical-operation';
import { SetCropPestControlUseCase, PestNotFoundError } from '../../application/pest/set-crop-pest-control.use-case';
import { ListCropPestsUseCase } from '../../application/pest/list-crop-pests.use-case';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { ControlMethodJSON } from '../../domain/pest/control-method';
import { SetCropNutritionUseCase } from '../../application/crop/set-crop-nutrition.use-case';
import { SetCropYieldsUseCase } from '../../application/crop/set-crop-yields.use-case';
import { AddPricePointUseCase } from '../../application/price/add-price-point.use-case';
import { ListCropPricesUseCase } from '../../application/price/list-crop-prices.use-case';
import { NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { YieldReferenceJSON } from '../../domain/crop/yield-reference';
import { GetCropHistoryUseCase } from '../../application/crop/get-crop-history.use-case';

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
    private readonly setSuitability: SetCropZoneSuitabilityUseCase,
    private readonly listCropZones: ListCropZonesUseCase,
    private readonly setPhenology: SetCropPhenologyUseCase,
    private readonly addWindow: AddCroppingWindowUseCase,
    private readonly listWindows: ListCroppingWindowsUseCase,
    private readonly setPestControl: SetCropPestControlUseCase,
    private readonly listCropPests: ListCropPestsUseCase,
    private readonly setNutrition: SetCropNutritionUseCase,
    private readonly setYields: SetCropYieldsUseCase,
    private readonly addPrice: AddPricePointUseCase,
    private readonly listPrices: ListCropPricesUseCase,
    private readonly getHistory: GetCropHistoryUseCase,
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
    return this.composeCropDocument(id, snap);
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
      return toCropDocument(snap, { varieties: vars });
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

  @Put(':id/zones/:zoneId')
  async setZone(
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
    @Body() body: { rating: SuitabilityRating; justification?: string; provenance?: ProvenanceProps },
  ) {
    try {
      return await this.setSuitability.execute({ cropId: id, zoneId, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError || e instanceof ZoneNotFoundError) throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Get(':id/zones')
  async getZones(@Param('id') id: string) {
    return this.listCropZones.execute({ cropId: id });
  }

  @Patch(':id/phenology')
  async phenology(@Param('id') id: string, @Body() body: { stages: PhenologicalStageJSON[] }) {
    try {
      const snap = await this.setPhenology.execute({ cropId: id, actor: ACTOR, stages: body.stages });
      const vars = await this.varieties.listByCrop(id);
      const zones = await this.listCropZones.execute({ cropId: id });
      const windows = await this.listWindows.execute({ cropId: id });
      return toCropDocument(snap, { varieties: vars, zones, windows });
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/windows')
  async createWindow(
    @Param('id') id: string,
    @Body() body: { zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean; operations?: TechnicalOperationJSON[]; notes?: string },
  ) {
    try {
      return await this.addWindow.execute({ cropId: id, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError || e instanceof ZoneNotFoundError) throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Get(':id/windows')
  async getWindows(@Param('id') id: string) {
    return this.listWindows.execute({ cropId: id });
  }

  @Put(':id/pests/:pestId')
  async setPest(
    @Param('id') id: string,
    @Param('pestId') pestId: string,
    @Body() body: { susceptibility: SusceptibilityLevel; sensitiveStages?: string[]; threshold?: string; controlMethods?: ControlMethodJSON[]; provenance?: ProvenanceProps },
  ) {
    try {
      return await this.setPestControl.execute({ cropId: id, pestId, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError || e instanceof PestNotFoundError) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }

  @Get(':id/pests')
  async getPests(@Param('id') id: string) {
    return this.listCropPests.execute({ cropId: id });
  }

  @Patch(':id/nutrition')
  async nutrition(@Param('id') id: string, @Body() body: { requirements: NutrientRequirementJSON[] }) {
    try {
      const snap = await this.setNutrition.execute({ cropId: id, actor: ACTOR, requirements: body.requirements });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/yields')
  async yields(@Param('id') id: string, @Body() body: { yields: YieldReferenceJSON[] }) {
    try {
      const snap = await this.setYields.execute({ cropId: id, actor: ACTOR, yields: body.yields });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Post(':id/prices')
  async createPrice(
    @Param('id') id: string,
    @Body() body: { market: string; date: string; price: number; unit: string; currency: string },
  ) {
    try {
      return await this.addPrice.execute({ cropId: id, actor: ACTOR, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Get(':id/prices')
  async getPrices(@Param('id') id: string) {
    return this.listPrices.execute({ cropId: id });
  }

  @Get(':id/history')
  async history(@Param('id') id: string) {
    try {
      return await this.getHistory.execute({ cropId: id });
    } catch (e) {
      if (e instanceof CropNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  private async composeCropDocument(id: string, snap: CropSnapshot) {
    const varieties = await this.varieties.listByCrop(id);
    const zones = await this.listCropZones.execute({ cropId: id });
    const windows = await this.listWindows.execute({ cropId: id });
    const pests = await this.listCropPests.execute({ cropId: id });
    const prices = await this.listPrices.execute({ cropId: id });
    return toCropDocument(snap, { varieties, zones, windows, pests, prices });
  }
}
