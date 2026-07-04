import { Module } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { SystemClock } from './infrastructure/system-clock';
import { PrismaCropRepository } from './infrastructure/crop/prisma-crop.repository';
import { PrismaAuditLogRepository } from './infrastructure/audit/prisma-audit-log.repository';
import { PrismaVarietyRepository } from './infrastructure/crop/prisma-variety.repository';
import { UuidIdGenerator } from './infrastructure/uuid-id-generator';
import { CROP_REPOSITORY } from './application/crop/crop.repository';
import { AUDIT_LOG_REPOSITORY } from './application/audit/audit-log.repository';
import { CLOCK } from './application/shared/clock';
import { VARIETY_REPOSITORY } from './application/crop/variety.repository';
import { CreateCropUseCase } from './application/crop/create-crop.use-case';
import { UpdateCropUseCase } from './application/crop/update-crop.use-case';
import { PublishCropUseCase } from './application/crop/publish-crop.use-case';
import { SetCropRequirementsUseCase } from './application/crop/set-crop-requirements.use-case';
import { AddVarietyUseCase } from './application/crop/add-variety.use-case';
import { ListVarietiesUseCase } from './application/crop/list-varieties.use-case';
import { CropController } from './presentation/crop/crop.controller';

@Module({
  controllers: [CropController],
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
  ],
})
export class CropModule {}
