import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { SystemClock } from './infrastructure/system-clock';
import { UuidIdGenerator } from './infrastructure/uuid-id-generator';
import { CLOCK } from './application/shared/clock';
import { BENEFICIARY_REPOSITORY } from './application/parcel/beneficiary.repository';
import { PrismaBeneficiaryRepository } from './infrastructure/parcel/prisma-beneficiary.repository';
import { CreateBeneficiaryUseCase, ListBeneficiariesUseCase, UpdateBeneficiaryUseCase, DeleteBeneficiaryUseCase } from './application/parcel/beneficiary.use-cases';
import { BeneficiaryController } from './presentation/parcel/beneficiary.controller';
import { PARCEL_REPOSITORY } from './application/parcel/parcel.repository';
import { PrismaParcelRepository } from './infrastructure/parcel/prisma-parcel.repository';
import { CreateParcelUseCase, ListParcelsUseCase, UpdateParcelUseCase, DeleteParcelUseCase } from './application/parcel/parcel.use-cases';
import { ParcelController } from './presentation/parcel/parcel.controller';
import { CAMPAIGN_REPOSITORY } from './application/parcel/campaign.repository';
import { PrismaCampaignRepository } from './infrastructure/parcel/prisma-campaign.repository';
import { CreateCampaignUseCase, ListCampaignsByParcelUseCase, UpdateCampaignUseCase, DeleteCampaignUseCase } from './application/parcel/campaign.use-cases';
import { CampaignController } from './presentation/parcel/campaign.controller';
import { OPERATION_LOG_REPOSITORY } from './application/parcel/operation-log.repository';
import { PrismaOperationLogRepository } from './infrastructure/parcel/prisma-operation-log.repository';
import { CreateOperationLogUseCase, ListOperationsByCampaignUseCase, UpdateOperationLogUseCase, DeleteOperationLogUseCase } from './application/parcel/operation-log.use-cases';
import { OperationLogController } from './presentation/parcel/operation-log.controller';

@Module({
  imports: [AuthModule],
  controllers: [BeneficiaryController, ParcelController, CampaignController, OperationLogController],
  providers: [
    PrismaService,
    { provide: CLOCK, useClass: SystemClock },
    UuidIdGenerator,
    { provide: BENEFICIARY_REPOSITORY, useClass: PrismaBeneficiaryRepository },
    { provide: CreateBeneficiaryUseCase, useFactory: (r, c, ids) => new CreateBeneficiaryUseCase(r, c, ids), inject: [BENEFICIARY_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListBeneficiariesUseCase, useFactory: (r) => new ListBeneficiariesUseCase(r), inject: [BENEFICIARY_REPOSITORY] },
    { provide: UpdateBeneficiaryUseCase, useFactory: (r) => new UpdateBeneficiaryUseCase(r), inject: [BENEFICIARY_REPOSITORY] },
    { provide: DeleteBeneficiaryUseCase, useFactory: (r) => new DeleteBeneficiaryUseCase(r), inject: [BENEFICIARY_REPOSITORY] },
    { provide: PARCEL_REPOSITORY, useClass: PrismaParcelRepository },
    { provide: CreateParcelUseCase, useFactory: (r, b, c, ids) => new CreateParcelUseCase(r, b, c, ids), inject: [PARCEL_REPOSITORY, BENEFICIARY_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListParcelsUseCase, useFactory: (r) => new ListParcelsUseCase(r), inject: [PARCEL_REPOSITORY] },
    { provide: UpdateParcelUseCase, useFactory: (r, b) => new UpdateParcelUseCase(r, b), inject: [PARCEL_REPOSITORY, BENEFICIARY_REPOSITORY] },
    { provide: DeleteParcelUseCase, useFactory: (r) => new DeleteParcelUseCase(r), inject: [PARCEL_REPOSITORY] },
    { provide: CAMPAIGN_REPOSITORY, useClass: PrismaCampaignRepository },
    { provide: CreateCampaignUseCase, useFactory: (r, p, c, ids) => new CreateCampaignUseCase(r, p, c, ids), inject: [CAMPAIGN_REPOSITORY, PARCEL_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListCampaignsByParcelUseCase, useFactory: (r) => new ListCampaignsByParcelUseCase(r), inject: [CAMPAIGN_REPOSITORY] },
    { provide: UpdateCampaignUseCase, useFactory: (r) => new UpdateCampaignUseCase(r), inject: [CAMPAIGN_REPOSITORY] },
    { provide: DeleteCampaignUseCase, useFactory: (r) => new DeleteCampaignUseCase(r), inject: [CAMPAIGN_REPOSITORY] },
    { provide: OPERATION_LOG_REPOSITORY, useClass: PrismaOperationLogRepository },
    { provide: CreateOperationLogUseCase, useFactory: (r, c, clk, ids) => new CreateOperationLogUseCase(r, c, clk, ids), inject: [OPERATION_LOG_REPOSITORY, CAMPAIGN_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListOperationsByCampaignUseCase, useFactory: (r) => new ListOperationsByCampaignUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
    { provide: UpdateOperationLogUseCase, useFactory: (r) => new UpdateOperationLogUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
    { provide: DeleteOperationLogUseCase, useFactory: (r) => new DeleteOperationLogUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
  ],
})
export class SuiviModule {}
