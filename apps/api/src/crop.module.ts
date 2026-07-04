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
import { AUDIT_LOG_REPOSITORY } from './application/audit/audit-log.repository';
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
import { SetCropZoneSuitabilityUseCase } from './application/zone/set-crop-zone-suitability.use-case';
import { ListCropZonesUseCase } from './application/zone/list-crop-zones.use-case';
import { AddCroppingWindowUseCase } from './application/window/add-cropping-window.use-case';
import { ListCroppingWindowsUseCase } from './application/window/list-cropping-windows.use-case';
import { CropController } from './presentation/crop/crop.controller';
import { ZoneController } from './presentation/zone/zone.controller';

@Module({
  controllers: [CropController, ZoneController],
  providers: [
    PrismaService,
    { provide: CLOCK, useClass: SystemClock },
    { provide: CROP_REPOSITORY, useClass: PrismaCropRepository },
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    { provide: VARIETY_REPOSITORY, useClass: PrismaVarietyRepository },
    UuidIdGenerator,
    {
      provide: CreateCropUseCase,
      useFactory: (r, a, c) => new CreateCropUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: UpdateCropUseCase,
      useFactory: (r, a, c) => new UpdateCropUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: PublishCropUseCase,
      useFactory: (r, a, c) => new PublishCropUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: SetCropRequirementsUseCase,
      useFactory: (r, a, c) => new SetCropRequirementsUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddVarietyUseCase,
      useFactory: (cr, vr, a, c, ids) => new AddVarietyUseCase(cr, vr, a, c, ids),
      inject: [CROP_REPOSITORY, VARIETY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
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
      provide: SetCropZoneSuitabilityUseCase,
      useFactory: (cr, z, s, a, c) => new SetCropZoneSuitabilityUseCase(cr, z, s, a, c),
      inject: [CROP_REPOSITORY, ZONE_REPOSITORY, CROP_ZONE_SUITABILITY_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: ListCropZonesUseCase,
      useFactory: (s, z) => new ListCropZonesUseCase(s, z),
      inject: [CROP_ZONE_SUITABILITY_REPOSITORY, ZONE_REPOSITORY],
    },
    { provide: CROPPING_WINDOW_REPOSITORY, useClass: PrismaCroppingWindowRepository },
    {
      provide: SetCropPhenologyUseCase,
      useFactory: (r, a, c) => new SetCropPhenologyUseCase(r, a, c),
      inject: [CROP_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: AddCroppingWindowUseCase,
      useFactory: (cr, z, w, a, c, ids) => new AddCroppingWindowUseCase(cr, z, w, a, c, ids),
      inject: [CROP_REPOSITORY, ZONE_REPOSITORY, CROPPING_WINDOW_REPOSITORY, AUDIT_LOG_REPOSITORY, CLOCK, UuidIdGenerator],
    },
    {
      provide: ListCroppingWindowsUseCase,
      useFactory: (w) => new ListCroppingWindowsUseCase(w),
      inject: [CROPPING_WINDOW_REPOSITORY],
    },
  ],
})
export class CropModule {}
