import { Body, Controller, Get, Param, Post, UseGuards, ConflictException, UnauthorizedException, NotFoundException, GoneException } from '@nestjs/common';
import { RegisterUseCase } from '../../application/auth/register.use-case';
import { LoginUseCase } from '../../application/auth/login.use-case';
import { GetMeUseCase } from '../../application/auth/get-me.use-case';
import { CreateInvitationUseCase } from '../../application/auth/create-invitation.use-case';
import { ListInvitationsUseCase } from '../../application/auth/list-invitations.use-case';
import { RevokeInvitationUseCase } from '../../application/auth/revoke-invitation.use-case';
import { AcceptInvitationUseCase } from '../../application/auth/accept-invitation.use-case';
import { EmailAlreadyUsedError, InvalidCredentialsError, InvitationNotFoundError, InvitationInvalidError, ForbiddenOrgError } from '../../application/auth/errors';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { Public, Roles, CurrentUser, AuthUser } from './decorators';

@Controller('auth')
@UseGuards(AuthGuard, RolesGuard)
export class AuthController {
  constructor(
    private readonly registerUC: RegisterUseCase,
    private readonly loginUC: LoginUseCase,
    private readonly meUC: GetMeUseCase,
    private readonly createInvitationUC: CreateInvitationUseCase,
    private readonly listInvitationsUC: ListInvitationsUseCase,
    private readonly revokeInvitationUC: RevokeInvitationUseCase,
    private readonly acceptInvitationUC: AcceptInvitationUseCase,
  ) {}

  @Public() @Post('register')
  async register(@Body() body: { email: string; password: string; name: string; organizationName: string }) {
    try { return await this.registerUC.execute(body); }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e; }
  }

  @Public() @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try { return await this.loginUC.execute(body); }
    catch (e) { if (e instanceof InvalidCredentialsError) throw new UnauthorizedException('identifiants invalides'); throw e; }
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) { return this.meUC.execute({ userId: user.sub }); }

  @Roles('admin') @Post('invitations')
  async invite(@CurrentUser() user: AuthUser, @Body() body: { email: string }) {
    try { return await this.createInvitationUC.execute({ organizationId: user.organizationId!, email: body.email, invitedByUserId: user.sub }); }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('déjà membre'); throw e; }
  }

  @Roles('admin') @Get('invitations')
  async listInvitations(@CurrentUser() user: AuthUser) { return this.listInvitationsUC.execute({ organizationId: user.organizationId! }); }

  @Roles('admin') @Post('invitations/:id/revoke')
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try { await this.revokeInvitationUC.execute({ id, organizationId: user.organizationId! }); return { ok: true }; }
    catch (e) { if (e instanceof InvitationNotFoundError) throw new NotFoundException(); if (e instanceof ForbiddenOrgError) throw new NotFoundException(); throw e; }
  }

  @Public() @Post('invitations/:token/accept')
  async accept(@Param('token') token: string, @Body() body: { name: string; password: string }) {
    try { return await this.acceptInvitationUC.execute({ token, name: body.name, password: body.password }); }
    catch (e) {
      if (e instanceof InvitationNotFoundError || e instanceof InvitationInvalidError) throw new GoneException('invitation invalide ou expirée');
      if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e;
    }
  }
}
