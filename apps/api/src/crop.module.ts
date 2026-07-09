import { Module } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { SystemClock } from './infrastructure/system-clock';
import { PrismaCropRepository } from './infrastructure/crop/prisma-crop.repository';
import { PrismaAuditLogRepository } from './infrastructure/audit/prisma-audit-log.repository';
import { PrismaVarietyRepository } from './infrastructure/crop/prisma-variety.repository';
import { PrismaZoneRepository } from './infrastructure/zone/prisma-zone.repository';
import { PrismaCropZoneSuitabilityRepository } from './infrastructure/zone/prisma-crop-zone-suitability.repository';
import { PrismaCroppingWindowRepository } from './infrastructure/window/prisma-cropping-window.repository';
import { UuidIdGenerator } from './infrastructure/uuid-id-generator';
import { CROP_REPOSITORY } from './application/crop/crop.repository';
import { CROP_EVENT_STORE } from './application/crop/crop-event-store';
import { PrismaCropEventStore } from './infrastructure/crop/prisma-crop-event-store';
import { AUDIT_LOG_REPOSITORY, AUDIT_LOG_READER } from './application/audit/audit-log.repository';
import { CLOCK } from './application/shared/clock';
import { VARIETY_REPOSITORY } from './application/crop/variety.repository';
import { ZONE_REPOSITORY } from './application/zone/zone.repository';
import { CROP_ZONE_SUITABILITY_REPOSITORY } from './application/zone/crop-zone-suitability.repository';
import { CROPPING_WINDOW_REPOSITORY } from './application/window/cropping-window.repository';
import { CreateCropUseCase } from './application/crop/create-crop.use-case';
import { UpdateCropUseCase } from './application/crop/update-crop.use-case';
import { PublishCropUseCase } from './application/crop/publish-crop.use-case';
import { SetCropRequirementsUseCase } from './application/crop/set-crop-requirements.use-case';
import { SetCropPhenologyUseCase } from './application/crop/set-crop-phenology.use-case';
import { AddVarietyUseCase } from './application/crop/add-variety.use-case';
import { ListVarietiesUseCase } from './application/crop/list-varieties.use-case';
import { CreateZoneUseCase } from './application/zone/create-zone.use-case';
import { ListZonesUseCase } from './application/zone/list-zones.use-case';
import { UpdateZoneUseCase } from './application/zone/update-zone.use-case';
import { DeleteZoneUseCase } from './application/zone/delete-zone.use-case';
import { SetCropZoneSuitabilityUseCase } from './application/zone/set-crop-zone-suitability.use-case';
import { ListCropZonesUseCase } from './application/zone/list-crop-zones.use-case';
import { AddCroppingWindowUseCase } from './application/window/add-cropping-window.use-case';
import { ListCroppingWindowsUseCase } from './application/window/list-cropping-windows.use-case';
import { CropController } from './presentation/crop/crop.controller';
import { ZoneController } from './presentation/zone/zone.controller';
import { PestController } from './presentation/pest/pest.controller';
import { PrismaPestRepository } from './infrastructure/pest/prisma-pest.repository';
import { PrismaCropPestControlRepository } from './infrastructure/pest/prisma-crop-pest-control.repository';
import { PEST_REPOSITORY } from './application/pest/pest.repository';
import { CROP_PEST_CONTROL_REPOSITORY } from './application/pest/crop-pest-control.repository';
import { CreatePestUseCase } from './application/pest/create-pest.use-case';
import { ListPestsUseCase } from './application/pest/list-pests.use-case';
import { UpdatePestUseCase } from './application/pest/update-pest.use-case';
import { DeletePestUseCase } from './application/pest/delete-pest.use-case';
import { SetCropPestControlUseCase } from './application/pest/set-crop-pest-control.use-case';
import { ListCropPestsUseCase } from './application/pest/list-crop-pests.use-case';
import { PrismaPricePointRepository } from './infrastructure/price/prisma-price-point.repository';
import { PRICE_POINT_REPOSITORY } from './application/price/price-point.repository';
import { SetCropNutritionUseCase } from './application/crop/set-crop-nutrition.use-case';
import { SetCropYieldsUseCase } from './application/crop/set-crop-yields.use-case';
import { AddPricePointUseCase } from './application/price/add-price-point.use-case';
import { ListCropPricesUseCase } from './application/price/list-crop-prices.use-case';
import { GetCropHistoryUseCase } from './application/crop/get-crop-history.use-case';
import { CropDocumentComposer } from './application/crop/compose-crop-document';
import { PUBLISHED_CROP_REPOSITORY } from './application/crop/published-crop.repository';
import { PrismaPublishedCropRepository } from './infrastructure/crop/prisma-published-crop.repository';

@Module({
  controllers: [CropController, ZoneController, PestController],
  providers: [
    PrismaService,
    { provide: CLOCK, useClass: SystemClock },
    { provide: CROP_REPOSITORY, useClass: PrismaCropRepository },
    { provide: CROP_EVENT_STORE, useClass: PrismaCropEventStore },
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    { provide: AUDIT_LOG_READER, useClass: PrismaAuditLogRepository },
    { provide: VARIETY_REPOSITORY, useClass: PrismaVarietyRepository },
    UuidIdGenerator,
    {
      provide: CreateCropUseCase,
      useFactory: (es, r, a, c) => new CreateCropUseCase(es, r, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: UpdateCropUseCase,
      useFactory: (es, r, a, c) => new UpdateCropUseCase(es, r, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    { provide: PUBLISHED_CROP_REPOSITORY, useClass: PrismaPublishedCropRepository },
    {
      provide: CropDocumentComposer,
      useFactory: (v, z, w, p, pr) => new CropDocumentComposer(v, z, w, p, pr),
      inject: [ListVarietiesUseCase, ListCropZonesUseCase, ListCroppingWindowsUseCase, ListCropPestsUseCase, ListCropPricesUseCase],
    },
    {
      provide: PublishCropUseCase,
      useFactory: (es, r, a, c, comp, pub) => new PublishCropUseCase(es, r, a, c, comp, pub),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, CropDocumentComposer, PUBLISHED_CROP_REPOSITORY],
    },
    {
      provide: SetCropRequirementsUseCase,
      useFactory: (es, r, a, c) => new SetCropRequirementsUseCase(es, r, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddVarietyUseCase,
      useFactory: (es, vr, a, c, ids) => new AddVarietyUseCase(es, vr, a, c, ids),
      inject: [CROP_EVENT_STORE, VARIETY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListVarietiesUseCase,
      useFactory: (vr) => new ListVarietiesUseCase(vr),
      inject: [VARIETY_REPOSITORY],
    },
    { provide: ZONE_REPOSITORY, useClass: PrismaZoneRepository },
    { provide: CROP_ZONE_SUITABILITY_REPOSITORY, useClass: PrismaCropZoneSuitabilityRepository },
    {
      provide: CreateZoneUseCase,
      useFactory: (z, a, c, ids) => new CreateZoneUseCase(z, a, c, ids),
      inject: [ZONE_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListZonesUseCase,
      useFactory: (z) => new ListZonesUseCase(z),
      inject: [ZONE_REPOSITORY],
    },
    {
      provide: UpdateZoneUseCase,
      useFactory: (z, a, c) => new UpdateZoneUseCase(z, a, c),
      inject: [ZONE_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteZoneUseCase,
      useFactory: (z, l, a, c) => new DeleteZoneUseCase(z, l, a, c),
      inject: [ZONE_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: SetCropZoneSuitabilityUseCase,
      useFactory: (es, z, s, a, c) => new SetCropZoneSuitabilityUseCase(es, z, s, a, c),
      inject: [CROP_EVENT_STORE, ZONE_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: ListCropZonesUseCase,
      useFactory: (s, z) => new ListCropZonesUseCase(s, z),
      inject: [CROP_ZONE_SUITABILITY_REPOSITORY, ZONE_REPOSITORY],
    },
    { provide: CROPPING_WINDOW_REPOSITORY, useClass: PrismaCroppingWindowRepository },
    {
      provide: SetCropPhenologyUseCase,
      useFactory: (es, r, a, c) => new SetCropPhenologyUseCase(es, r, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddCroppingWindowUseCase,
      useFactory: (es, zr, wr, a, c, ids) => new AddCroppingWindowUseCase(es, zr, wr, a, c, ids),
      inject: [CROP_EVENT_STORE, ZONE_REPOSITORY, CROPPING_WINDOW_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListCroppingWindowsUseCase,
      useFactory: (w) => new ListCroppingWindowsUseCase(w),
      inject: [CROPPING_WINDOW_REPOSITORY],
    },
    { provide: PEST_REPOSITORY, useClass: PrismaPestRepository },
    { provide: CROP_PEST_CONTROL_REPOSITORY, useClass: PrismaCropPestControlRepository },
    {
      provide: CreatePestUseCase,
      useFactory: (p, a, c, ids) => new CreatePestUseCase(p, a, c, ids),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListPestsUseCase,
      useFactory: (p) => new ListPestsUseCase(p),
      inject: [PEST_REPOSITORY],
    },
    {
      provide: UpdatePestUseCase,
      useFactory: (p, a, c) => new UpdatePestUseCase(p, a, c),
      inject: [PEST_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: DeletePestUseCase,
      useFactory: (p, l, a, c) => new DeletePestUseCase(p, l, a, c),
      inject: [PEST_REPOSITORY, CROP_PEST_CONTROL_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: SetCropPestControlUseCase,
      useFactory: (es, p, ctrl, a, c) => new SetCropPestControlUseCase(es, p, ctrl, a, c),
      inject: [CROP_EVENT_STORE, PEST_REPOSITORY, CROP_PEST_CONTROL_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: ListCropPestsUseCase,
      useFactory: (ctrl, p) => new ListCropPestsUseCase(ctrl, p),
      inject: [CROP_PEST_CONTROL_REPOSITORY, PEST_REPOSITORY],
    },
    { provide: PRICE_POINT_REPOSITORY, useClass: PrismaPricePointRepository },
    {
      provide: SetCropNutritionUseCase,
      useFactory: (es, r, a, c) => new SetCropNutritionUseCase(es, r, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: SetCropYieldsUseCase,
      useFactory: (es, r, a, c) => new SetCropYieldsUseCase(es, r, a, c),
      inject: [CROP_EVENT_STORE, CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddPricePointUseCase,
      useFactory: (es, pr, a, c, ids) => new AddPricePointUseCase(es, pr, a, c, ids),
      inject: [CROP_EVENT_STORE, PRICE_POINT_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListCropPricesUseCase,
      useFactory: (pr) => new ListCropPricesUseCase(pr),
      inject: [PRICE_POINT_REPOSITORY],
    },
    {
      provide: GetCropHistoryUseCase,
      useFactory: (cr, reader) => new GetCropHistoryUseCase(cr, reader),
      inject: [CROP_REPOSITORY, AUDIT_LOG_READER],
    },
  ],
})
export class CropModule {}
