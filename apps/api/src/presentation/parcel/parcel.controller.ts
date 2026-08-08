import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException, NotFoundException, BadRequestException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateParcelUseCase, ListParcelsUseCase, UpdateParcelUseCase, DeleteParcelUseCase } from '../../application/parcel/parcel.use-cases';
import { ParcelNotFoundError, BeneficiaryNotFoundError } from '../../application/parcel/errors';

type ParcelBody = { name: string; beneficiaryId?: string; zoneId?: string; gpsLat?: number; gpsLng?: number; locality?: string; areaHectares?: number; notes?: string };

@Controller('parcels')
@UseGuards(AuthGuard, RolesGuard)
export class ParcelController {
  constructor(
    private readonly listUC: ListParcelsUseCase,
    private readonly createUC: CreateParcelUseCase,
    private readonly updateUC: UpdateParcelUseCase,
    private readonly deleteUC: DeleteParcelUseCase,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser) { return this.listUC.execute({ organizationId: this.org(user) }); }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: ParcelBody) {
    try { return await this.createUC.execute({ organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof BeneficiaryNotFoundError) throw new BadRequestException('bénéficiaire invalide'); throw e; }
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<ParcelBody>) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), ...body }); }
    catch (e) { if (e instanceof ParcelNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof ParcelNotFoundError) throw new NotFoundException(); throw e; }
  }
}
