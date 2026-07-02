import { Module } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { SystemClock } from './infrastructure/system-clock';
import { PrismaCropRepository } from './infrastructure/crop/prisma-crop.repository';
import { PrismaAuditLogRepository } from './infrastructure/audit/prisma-audit-log.repository';
import { CROP_REPOSITORY } from './application/crop/crop.repository';
import { AUDIT_LOG_REPOSITORY } from './application/audit/audit-log.repository';
import { CLOCK } from './application/shared/clock';
import { CreateCropUseCase } from './application/crop/create-crop.use-case';
import { UpdateCropUseCase } from './application/crop/update-crop.use-case';
import { PublishCropUseCase } from './application/crop/publish-crop.use-case';
import { CropController } from './presentation/crop/crop.controller';

@Module({
  controllers: [CropController],
  providers: [
    PrismaService,
    { provide: CLOCK, useClass: SystemClock },
    { provide: CROP_REPOSITORY, useClass: PrismaCropRepository },
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
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
  ],
})
export class CropModule {}
