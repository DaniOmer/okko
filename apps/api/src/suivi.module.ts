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

@Module({
  imports: [AuthModule],
  controllers: [BeneficiaryController, ParcelController],
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
  ],
})
export class SuiviModule {}
