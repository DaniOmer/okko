import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode, Inject } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateCampaignUseCase, ListCampaignsByParcelUseCase, UpdateCampaignUseCase, DeleteCampaignUseCase } from '../../application/parcel/campaign.use-cases';
import { GetCampaignRecommendationsUseCase } from '../../application/parcel/get-campaign-recommendations.use-case';
import { CampaignNotFoundError, ParcelNotFoundError, MissingCropError } from '../../application/parcel/errors';
import { SendCampaignReminderDigestUseCase } from '../../application/notification/send-campaign-reminder-digest.use-case';
import { GetCampaignStageAdviceUseCase } from '../../application/notification/get-campaign-stage-advice.use-case';
import { CLOCK, Clock } from '../../application/shared/clock';

type CampaignBody = { parcelId: string; cropId?: string; customCropName?: string; windowId?: string; varietyId?: string; season: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string };

@Controller('campaigns')
@UseGuards(AuthGuard, RolesGuard)
export class CampaignController {
  constructor(
    private readonly listUC: ListCampaignsByParcelUseCase,
    private readonly createUC: CreateCampaignUseCase,
    private readonly updateUC: UpdateCampaignUseCase,
    private readonly deleteUC: DeleteCampaignUseCase,
    private readonly recoUC: GetCampaignRecommendationsUseCase,
    private readonly reminderUC: SendCampaignReminderDigestUseCase,
    private readonly stageAdviceUC: GetCampaignStageAdviceUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get(':id/recommendations') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async recommendations(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return await this.recoUC.execute({ campaignId: id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Get(':id/stage-advice') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async stageAdvice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return await this.stageAdviceUC.execute({ campaignId: id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Post(':id/notify-reminder') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async notifyReminder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { return await this.reminderUC.execute({ campaignId: id, organizationId: this.org(user), today: this.clock.nowIso() }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query('parcelId') parcelId: string) {
    if (!parcelId) throw new BadRequestException('parcelId requis');
    return this.listUC.execute({ organizationId: this.org(user), parcelId });
  }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: CampaignBody) {
    try { return await this.createUC.execute({ organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof ParcelNotFoundError) throw new BadRequestException('parcelle invalide'); if (e instanceof MissingCropError) throw new BadRequestException('culture requise (cropId ou customCropName)'); throw e; }
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<Omit<CampaignBody, 'parcelId'>>) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new NotFoundException(); throw e; }
  }
}
