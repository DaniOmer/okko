import { Body, Controller, Get, Param, Patch, Post, Put, Query, NotFoundException, ConflictException, UnprocessableEntityException, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Public, Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { randomUUID } from 'crypto';
import { CreateCropUseCase } from '../../application/crop/create-crop.use-case';
import { UpdateCropUseCase } from '../../application/crop/update-crop.use-case';
import { PublishCropUseCase, CropNotFoundError, IncompleteCropError } from '../../application/crop/publish-crop.use-case';
import { CropStatusError } from '../../domain/crop/crop-status';
import { ConcurrencyError } from '../../application/crop/crop-event-store';
import { CROP_REPOSITORY, CropRepository } from '../../application/crop/crop.repository';
import { toCropDocument } from '../../application/crop/crop-read-model';
import { CropSnapshot } from '../../domain/crop/crop';
import { CycleType } from '../../domain/crop/cycle-type';
import { SetCropRequirementsUseCase } from '../../application/crop/set-crop-requirements.use-case';
import { AddVarietyUseCase } from '../../application/crop/add-variety.use-case';
import { UpdateVarietyUseCase, VarietyNotFoundError } from '../../application/crop/update-variety.use-case';
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
import { UpdateCroppingWindowUseCase, CroppingWindowNotFoundError } from '../../application/window/update-cropping-window.use-case';
import { ListCroppingWindowsUseCase } from '../../application/window/list-cropping-windows.use-case';
import { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { TechnicalOperationJSON } from '../../domain/window/technical-operation';
import { SetCropPestControlUseCase, PestNotFoundError } from '../../application/pest/set-crop-pest-control.use-case';
import { ListCropPestsUseCase } from '../../application/pest/list-crop-pests.use-case';
import { SusceptibilityLevel } from '../../domain/pest/susceptibility-level';
import { ControlMethodJSON } from '../../domain/pest/control-method';
import { SetCropNutritionUseCase } from '../../application/crop/set-crop-nutrition.use-case';
import { SetCropYieldsUseCase } from '../../application/crop/set-crop-yields.use-case';
import { SetCropCommercializationUseCase } from '../../application/crop/set-crop-commercialization.use-case';
import { SetCropImagesUseCase } from '../../application/crop/set-crop-images.use-case';
import { STORAGE_PORT, StoragePort } from '../../application/media/storage.port';
import { toImageDto } from '../media/image-dto';
import { AddPricePointUseCase, InvalidPricePeriodError } from '../../application/price/add-price-point.use-case';
import { UpdatePricePointUseCase, PricePointNotFoundError } from '../../application/price/update-price-point.use-case';
import { ListCropPricesUseCase } from '../../application/price/list-crop-prices.use-case';
import { NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { YieldReferenceJSON } from '../../domain/crop/yield-reference';
import { GetCropHistoryUseCase } from '../../application/crop/get-crop-history.use-case';
import { PUBLISHED_CROP_REPOSITORY, PublishedCropRepository } from '../../application/crop/published-crop.repository';
import { diffCropDocuments } from '../../application/crop/crop-diff';
import { DiscardDraftUseCase } from '../../application/crop/discard-draft.use-case';
import { RestoreDraftUseCase } from '../../application/crop/restore-draft.use-case';
import { ArchiveCropUseCase } from '../../application/crop/archive-crop.use-case';
import { UnarchiveCropUseCase } from '../../application/crop/unarchive-crop.use-case';
import { CropDocumentComposer } from '../../application/crop/compose-crop-document';
import { NoPublishedVersionError, RevisionNotFoundError } from '../../domain/crop/crop';

function mapCropError(e: unknown, id: string): never {
  if (e instanceof CropNotFoundError) throw new NotFoundException(id);
  if (e instanceof CropStatusError) throw new ConflictException((e as Error).message);
  if (e instanceof ConcurrencyError) throw new ConflictException((e as Error).message);
  if (e instanceof NoPublishedVersionError) throw new ConflictException((e as Error).message);
  if (e instanceof RevisionNotFoundError) throw new NotFoundException((e as Error).message);
  if (e instanceof IncompleteCropError) throw new UnprocessableEntityException((e as Error).message);
  if (e instanceof InvalidPricePeriodError) throw new UnprocessableEntityException((e as Error).message);
  if (e instanceof VarietyNotFoundError) throw new NotFoundException((e as Error).message);
  if (e instanceof PricePointNotFoundError) throw new NotFoundException((e as Error).message);
  throw e;
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('crops')
export class CropController {
  constructor(
    private readonly createCrop: CreateCropUseCase,
    private readonly updateCrop: UpdateCropUseCase,
    private readonly publishCrop: PublishCropUseCase,
    @Inject(CROP_REPOSITORY) private readonly crops: CropRepository,
    private readonly setRequirements: SetCropRequirementsUseCase,
    private readonly addVariety: AddVarietyUseCase,
    private readonly updateVarietyUC: UpdateVarietyUseCase,
    private readonly listVarieties: ListVarietiesUseCase,
    @Inject(VARIETY_REPOSITORY) private readonly varieties: VarietyRepository,
    private readonly setSuitability: SetCropZoneSuitabilityUseCase,
    private readonly listCropZones: ListCropZonesUseCase,
    private readonly setPhenology: SetCropPhenologyUseCase,
    private readonly addWindow: AddCroppingWindowUseCase,
    private readonly updateWindowUC: UpdateCroppingWindowUseCase,
    private readonly listWindows: ListCroppingWindowsUseCase,
    private readonly setPestControl: SetCropPestControlUseCase,
    private readonly listCropPests: ListCropPestsUseCase,
    private readonly setNutrition: SetCropNutritionUseCase,
    private readonly setYields: SetCropYieldsUseCase,
    private readonly setCommercializationUC: SetCropCommercializationUseCase,
    private readonly setImagesUC: SetCropImagesUseCase,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly addPrice: AddPricePointUseCase,
    private readonly updatePriceUC: UpdatePricePointUseCase,
    private readonly listPrices: ListCropPricesUseCase,
    private readonly getHistory: GetCropHistoryUseCase,
    private readonly discardDraft: DiscardDraftUseCase,
    private readonly restoreDraft: RestoreDraftUseCase,
    private readonly archiveCrop: ArchiveCropUseCase,
    private readonly unarchiveCrop: UnarchiveCropUseCase,
    private readonly composer: CropDocumentComposer,
    @Inject(PUBLISHED_CROP_REPOSITORY) private readonly publishedCrops: PublishedCropRepository,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: { commonNames: Record<string, string>; scientificName: string; family: string; cycleType: CycleType; usageCategory?: string; description?: Record<string, string> }) {
    const snap = await this.createCrop.execute({ id: randomUUID(), actor: user.email, ...body });
    return toCropDocument(snap);
  }

  @Get()
  async list() {
    const snaps = await this.crops.list();
    return Promise.all(snaps.map((s) => this.composeCropDocument(s.id, s)));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.crops.findById(id);
    if (!snap) throw new NotFoundException(id);
    return this.composeCropDocument(id, snap);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { commonNames?: Record<string, string>; metadata?: Record<string, unknown>; scientificName?: string; family?: string; cycleType?: CycleType; usageCategory?: string; description?: Record<string, string> }) {
    try {
      const snap = await this.updateCrop.execute({ id, actor: user.email, ...body });
      return toCropDocument(snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Post(':id/publish')
  async publish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body?: { note?: string }) {
    try {
      const snap = await this.publishCrop.execute({ id, actor: user.email, note: body?.note });
      return toCropDocument(snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Patch(':id/requirements')
  async requirements(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { climatic?: ClimaticRequirementsJSON; edaphic?: EdaphicRequirementsJSON },
  ) {
    try {
      const snap = await this.setRequirements.execute({ id, actor: user.email, ...body });
      const vars = await this.varieties.listByCrop(id);
      return toCropDocument(snap, { varieties: vars });
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Post(':id/varieties')
  async createVariety(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name: Record<string, string>; maturityDays?: number; yieldPotential?: ReturnType<RangeValue['toJSON']>; traits?: string[] },
  ) {
    try {
      return await this.addVariety.execute({ cropId: id, actor: user.email, ...body });
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Get(':id/varieties')
  async getVarieties(@Param('id') id: string) {
    return this.listVarieties.execute({ cropId: id });
  }

  @Put(':id/varieties/:varietyId')
  async updateVariety(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('varietyId') varietyId: string,
    @Body() body: { name: Record<string, string>; maturityDays?: number; traits?: string[] },
  ) {
    try {
      return await this.updateVarietyUC.execute({ cropId: id, varietyId, ...body, actor: user.email });
    } catch (e) { mapCropError(e, id); }
  }

  @Put(':id/zones/:zoneId')
  async setZone(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
    @Body() body: { rating: SuitabilityRating; justification?: string; provenance?: ProvenanceProps },
  ) {
    try {
      return await this.setSuitability.execute({ cropId: id, zoneId, actor: user.email, ...body });
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
  async phenology(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { stages: PhenologicalStageJSON[] }) {
    try {
      const snap = await this.setPhenology.execute({ cropId: id, actor: user.email, stages: body.stages });
      const vars = await this.varieties.listByCrop(id);
      const zones = await this.listCropZones.execute({ cropId: id });
      const windows = await this.listWindows.execute({ cropId: id });
      return toCropDocument(snap, { varieties: vars, zones, windows });
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Post(':id/windows')
  async createWindow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean; operations?: TechnicalOperationJSON[]; notes?: string },
  ) {
    try {
      return await this.addWindow.execute({ cropId: id, actor: user.email, ...body });
    } catch (e) {
      if (e instanceof CropNotFoundError || e instanceof ZoneNotFoundError) throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Get(':id/windows')
  async getWindows(@Param('id') id: string) {
    return this.listWindows.execute({ cropId: id });
  }

  @Put(':id/windows/:windowId')
  async updateWindow(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('windowId') windowId: string,
    @Body() body: { zoneId: string; season: string; sowingStart?: string; sowingEnd?: string; irrigationRequired?: boolean; operations?: TechnicalOperationJSON[]; notes?: string },
  ) {
    try { return await this.updateWindowUC.execute({ cropId: id, windowId, ...body, actor: user.email }); }
    catch (e) {
      if (e instanceof CropNotFoundError || e instanceof ZoneNotFoundError || e instanceof CroppingWindowNotFoundError) throw new NotFoundException((e as Error).message);
      throw e;
    }
  }

  @Put(':id/pests/:pestId')
  async setPest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('pestId') pestId: string,
    @Body() body: { susceptibility: SusceptibilityLevel; sensitiveStages?: string[]; threshold?: string; controlMethods?: ControlMethodJSON[]; provenance?: ProvenanceProps },
  ) {
    try {
      return await this.setPestControl.execute({ cropId: id, pestId, actor: user.email, ...body });
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
  async nutrition(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { requirements: NutrientRequirementJSON[] }) {
    try {
      const snap = await this.setNutrition.execute({ cropId: id, actor: user.email, requirements: body.requirements });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Patch(':id/yields')
  async yields(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { yields: YieldReferenceJSON[] }) {
    try {
      const snap = await this.setYields.execute({ cropId: id, actor: user.email, yields: body.yields });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Roles('superadmin')
  @Post(':id/commercialization')
  async setCommercialization(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { commercialization: { form: string; saleUnits: string[]; outlets: string[] }[] }) {
    try { const snap = await this.setCommercializationUC.execute({ cropId: id, actor: user.email, commercialization: body.commercialization }); return this.composeCropDocument(id, snap); }
    catch (e) { mapCropError(e, id); }
  }

  @Roles('superadmin')
  @Post(':id/images')
  async setImages(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { images: { key: string; caption?: string }[] }) {
    try { const snap = await this.setImagesUC.execute({ cropId: id, actor: user.email, images: body.images }); return this.composeCropDocument(id, snap); }
    catch (e) { mapCropError(e, id); }
  }

  @Post(':id/prices')
  async createPrice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { form: string; market: string; periodStart: string; periodEnd?: string; price: number; unit: string; currency: string },
  ) {
    try {
      return await this.addPrice.execute({ cropId: id, actor: user.email, ...body });
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Get(':id/prices')
  async getPrices(@Param('id') id: string) {
    return this.listPrices.execute({ cropId: id });
  }

  @Put(':id/prices/:priceId')
  async updatePrice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('priceId') priceId: string, @Body() body: { form: string; market: string; periodStart: string; periodEnd?: string; price: number; unit: string; currency: string }) {
    try { return await this.updatePriceUC.execute({ cropId: id, priceId, ...body, actor: user.email }); }
    catch (e) { mapCropError(e, id); }
  }

  @Get(':id/history')
  async history(@Param('id') id: string) {
    try {
      return await this.getHistory.execute({ cropId: id });
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Public()
  @Get(':id/published')
  async published(@Param('id') id: string) {
    try {
      const rec = await this.publishedCrops.findLatest(id);
      if (!rec) throw new NotFoundException(id);
      const doc = rec.document;
      return { ...doc, images: (doc.images ?? []).map((img) => toImageDto(img, this.storage)) };
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Get(':id/versions')
  async versions(@Param('id') id: string) {
    try {
      return await this.publishedCrops.listByCrop(id);
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Get(':id/versions/:revision')
  async version(@Param('id') id: string, @Param('revision') revision: string) {
    try {
      const rec = await this.publishedCrops.findRevision(id, Number(revision));
      if (!rec) throw new NotFoundException(`crop ${id} revision ${revision}`);
      return rec.document;
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Get(':id/diff')
  async diff(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    const fromRevision = Number(from);
    const toRevision = Number(to);
    if (!Number.isInteger(fromRevision)) throw new NotFoundException(`crop ${id} revision ${from}`);
    if (!Number.isInteger(toRevision)) throw new NotFoundException(`crop ${id} revision ${to}`);
    const a = await this.publishedCrops.findRevision(id, fromRevision);
    if (!a) throw new NotFoundException(`crop ${id} revision ${from}`);
    const b = await this.publishedCrops.findRevision(id, toRevision);
    if (!b) throw new NotFoundException(`crop ${id} revision ${to}`);
    return diffCropDocuments(fromRevision, toRevision, a.document, b.document);
  }

  @Post(':id/discard')
  async discard(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try {
      const snap = await this.discardDraft.execute({ id, actor: user.email });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Post(':id/versions/:revision/restore')
  async restore(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('revision') revision: string) {
    try {
      const snap = await this.restoreDraft.execute({ id, revision: Number(revision), actor: user.email });
      return this.composeCropDocument(id, snap);
    } catch (e) {
      mapCropError(e, id);
    }
  }

  @Post(':id/archive')
  async archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return toCropDocument(await this.archiveCrop.execute({ id, actor: user.email })); }
    catch (e) { mapCropError(e, id); }
  }

  @Post(':id/unarchive')
  async unarchive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return toCropDocument(await this.unarchiveCrop.execute({ id, actor: user.email })); }
    catch (e) { mapCropError(e, id); }
  }

  private async composeCropDocument(id: string, snap: CropSnapshot) {
    const doc = await this.composer.compose(id, snap);
    return { ...doc, images: doc.images.map((img) => toImageDto(img, this.storage)) };
  }
}
