import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateOperationLogUseCase, ListOperationsByCampaignUseCase, UpdateOperationLogUseCase, DeleteOperationLogUseCase } from '../../application/parcel/operation-log.use-cases';
import { OperationLogNotFoundError, CampaignNotFoundError } from '../../application/parcel/errors';
import { OperationType } from '../../domain/window/operation-type';
import { OperationInput } from '../../domain/parcel/operation-log';

type OpBody = { campaignId: string; type: OperationType; date: string; inputs?: OperationInput[]; laborCost?: number; notes?: string };

@Controller('operations')
@UseGuards(AuthGuard, RolesGuard)
export class OperationLogController {
  constructor(
    private readonly listUC: ListOperationsByCampaignUseCase,
    private readonly createUC: CreateOperationLogUseCase,
    private readonly updateUC: UpdateOperationLogUseCase,
    private readonly deleteUC: DeleteOperationLogUseCase,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query('campaignId') campaignId: string) {
    if (!campaignId) throw new BadRequestException('campaignId requis');
    return this.listUC.execute({ organizationId: this.org(user), campaignId });
  }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: OpBody) {
    try { return await this.createUC.execute({ organizationId: this.org(user), recordedByUserId: user.sub, ...body }); }
    catch (e) { if (e instanceof CampaignNotFoundError) throw new BadRequestException('campagne invalide'); throw e; }
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<Omit<OpBody, 'campaignId'>>) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof OperationLogNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof OperationLogNotFoundError) throw new NotFoundException(); throw e; }
  }
}
