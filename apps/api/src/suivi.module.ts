import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { GetCampaignRecommendationsUseCase } from './application/parcel/get-campaign-recommendations.use-case';
import { CROPPING_WINDOW_REPOSITORY } from './application/window/cropping-window.repository';
import { PrismaCroppingWindowRepository } from './infrastructure/window/prisma-cropping-window.repository';
import { STORAGE_PORT } from './application/media/storage.port';
import { S3Storage } from './infrastructure/media/s3-storage';
import { USER_REPOSITORY } from './application/auth/repositories';
import { PrismaUserRepository } from './infrastructure/auth/prisma-user.repository';
import { NOTIFICATION_PORT } from './application/notification/notification-port';
import { BrevoEmailNotificationSender } from './infrastructure/notification/brevo-email-notification-sender';
import { NOTIFICATION_PREFERENCE_REPOSITORY } from './application/notification/notification-preference.repository';
import { PrismaNotificationPreferenceRepository } from './infrastructure/notification/prisma-notification-preference.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './application/notification/notification-log.repository';
import { PrismaNotificationLogRepository } from './infrastructure/notification/prisma-notification-log.repository';
import { SendCampaignReminderDigestUseCase } from './application/notification/send-campaign-reminder-digest.use-case';
import { RunDueRemindersUseCase } from './application/notification/run-due-reminders.use-case';
import { RemindersScheduler } from './presentation/notification/reminders.scheduler';
import { NotificationPreferenceController } from './presentation/notification/notification-preference.controller';

@Module({
  imports: [AuthModule, ScheduleModule.forRoot()],
  controllers: [BeneficiaryController, ParcelController, CampaignController, OperationLogController, NotificationPreferenceController],
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
    { provide: DeleteCampaignUseCase, useFactory: (r, o) => new DeleteCampaignUseCase(r, o), inject: [CAMPAIGN_REPOSITORY, OPERATION_LOG_REPOSITORY] },
    { provide: OPERATION_LOG_REPOSITORY, useClass: PrismaOperationLogRepository },
    { provide: STORAGE_PORT, useFactory: () => S3Storage.fromEnv() },
    { provide: CreateOperationLogUseCase, useFactory: (r, c, clk, ids) => new CreateOperationLogUseCase(r, c, clk, ids), inject: [OPERATION_LOG_REPOSITORY, CAMPAIGN_REPOSITORY, CLOCK, UuidIdGenerator] },
    { provide: ListOperationsByCampaignUseCase, useFactory: (r) => new ListOperationsByCampaignUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
    { provide: UpdateOperationLogUseCase, useFactory: (r) => new UpdateOperationLogUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
    { provide: DeleteOperationLogUseCase, useFactory: (r) => new DeleteOperationLogUseCase(r), inject: [OPERATION_LOG_REPOSITORY] },
    { provide: CROPPING_WINDOW_REPOSITORY, useClass: PrismaCroppingWindowRepository },
    { provide: GetCampaignRecommendationsUseCase, useFactory: (c, o, w, clk) => new GetCampaignRecommendationsUseCase(c, o, w, clk), inject: [CAMPAIGN_REPOSITORY, OPERATION_LOG_REPOSITORY, CROPPING_WINDOW_REPOSITORY, CLOCK] },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: NOTIFICATION_PORT, useClass: BrevoEmailNotificationSender },
    { provide: NOTIFICATION_PREFERENCE_REPOSITORY, useClass: PrismaNotificationPreferenceRepository },
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: PrismaNotificationLogRepository },
    { provide: SendCampaignReminderDigestUseCase, useFactory: (c, p, reco, u, pref, log, notif, clk, ids) => new SendCampaignReminderDigestUseCase(c, p, reco, u, pref, log, notif, clk, ids), inject: [CAMPAIGN_REPOSITORY, PARCEL_REPOSITORY, GetCampaignRecommendationsUseCase, USER_REPOSITORY, NOTIFICATION_PREFERENCE_REPOSITORY, NOTIFICATION_LOG_REPOSITORY, NOTIFICATION_PORT, CLOCK, UuidIdGenerator] },
    { provide: RunDueRemindersUseCase, useFactory: (c, sender) => new RunDueRemindersUseCase(c, sender), inject: [CAMPAIGN_REPOSITORY, SendCampaignReminderDigestUseCase] },
    RemindersScheduler,
  ],
})
export class SuiviModule {}
