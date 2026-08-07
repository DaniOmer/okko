import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ForbiddenException, NotFoundException, HttpCode } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreateBeneficiaryUseCase, ListBeneficiariesUseCase, UpdateBeneficiaryUseCase, DeleteBeneficiaryUseCase } from '../../application/parcel/beneficiary.use-cases';
import { BeneficiaryNotFoundError } from '../../application/parcel/errors';

@Controller('beneficiaries')
@UseGuards(AuthGuard, RolesGuard)
export class BeneficiaryController {
  constructor(
    private readonly listUC: ListBeneficiariesUseCase,
    private readonly createUC: CreateBeneficiaryUseCase,
    private readonly updateUC: UpdateBeneficiaryUseCase,
    private readonly deleteUC: DeleteBeneficiaryUseCase,
  ) {}

  private org(user: AuthUser): string { if (!user.organizationId) throw new ForbiddenException(); return user.organizationId; }

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async list(@CurrentUser() user: AuthUser) { return this.listUC.execute({ organizationId: this.org(user) }); }

  @Post() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async create(@CurrentUser() user: AuthUser, @Body() body: { name: string; phone?: string; notes?: string }) {
    return this.createUC.execute({ organizationId: this.org(user), name: body.name, phone: body.phone, notes: body.notes });
  }

  @Patch(':id') @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { name?: string; phone?: string; notes?: string }) {
    try { return await this.updateUC.execute({ id, organizationId: this.org(user), name: body.name, phone: body.phone, notes: body.notes }); }
    catch (e) { if (e instanceof BeneficiaryNotFoundError) throw new NotFoundException(); throw e; }
  }

  @Delete(':id') @HttpCode(204) @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.deleteUC.execute({ id, organizationId: this.org(user) }); }
    catch (e) { if (e instanceof BeneficiaryNotFoundError) throw new NotFoundException(); throw e; }
  }
}
