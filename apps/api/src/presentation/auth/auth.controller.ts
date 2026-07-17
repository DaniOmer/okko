import { Body, Controller, Get, Param, Post, UseGuards, HttpCode, ConflictException, UnauthorizedException, NotFoundException, GoneException, ForbiddenException } from '@nestjs/common';
import { RegisterUseCase } from '../../application/auth/register.use-case';
import { LoginUseCase } from '../../application/auth/login.use-case';
import { GetMeUseCase } from '../../application/auth/get-me.use-case';
import { CreateInvitationUseCase } from '../../application/auth/create-invitation.use-case';
import { ListInvitationsUseCase } from '../../application/auth/list-invitations.use-case';
import { RevokeInvitationUseCase } from '../../application/auth/revoke-invitation.use-case';
import { AcceptInvitationUseCase } from '../../application/auth/accept-invitation.use-case';
import { ConfirmEmailUseCase } from '../../application/auth/confirm-email.use-case';
import { ResendConfirmationUseCase } from '../../application/auth/resend-confirmation.use-case';
import { EmailAlreadyUsedError, InvalidCredentialsError, InvitationNotFoundError, InvitationInvalidError, ForbiddenOrgError, EmailNotConfirmedError, ConfirmationInvalidError } from '../../application/auth/errors';
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
    private readonly confirmEmailUC: ConfirmEmailUseCase,
    private readonly resendConfirmationUC: ResendConfirmationUseCase,
  ) {}

  @Public() @Post('register')
  async register(@Body() body: { email: string; password: string; firstName: string; lastName: string; organizationName: string }) {
    try { const { email } = await this.registerUC.execute(body); return { status: 'confirmation_sent', email }; }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e; }
  }

  @Public() @Post('confirm/resend') @HttpCode(202)
  async resendConfirmation(@Body() body: { email: string }) {
    await this.resendConfirmationUC.execute({ email: body.email });
    return { status: 'sent' };
  }

  @Public() @Post('confirm/:token') @HttpCode(200)
  async confirm(@Param('token') token: string) {
    try { return await this.confirmEmailUC.execute({ token }); }
    catch (e) { if (e instanceof ConfirmationInvalidError) throw new GoneException('lien de confirmation invalide ou expiré'); throw e; }
  }

  @Public() @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try { return await this.loginUC.execute(body); }
    catch (e) {
      if (e instanceof InvalidCredentialsError) throw new UnauthorizedException('identifiants invalides');
      if (e instanceof EmailNotConfirmedError) throw new ForbiddenException('Confirmez votre email avant de vous connecter');
      throw e;
    }
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) { return this.meUC.execute({ userId: user.sub }); }

  @Roles('admin') @Post('invitations')
  async invite(@CurrentUser() user: AuthUser, @Body() body: { email: string }) {
    if (!user.organizationId) throw new ForbiddenException();
    try { return await this.createInvitationUC.execute({ organizationId: user.organizationId, email: body.email, invitedByUserId: user.sub }); }
    catch (e) { if (e instanceof EmailAlreadyUsedError) throw new ConflictException('déjà membre'); throw e; }
  }

  @Roles('admin') @Get('invitations')
  async listInvitations(@CurrentUser() user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException();
    return this.listInvitationsUC.execute({ organizationId: user.organizationId });
  }

  @Roles('admin') @Post('invitations/:id/revoke')
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!user.organizationId) throw new ForbiddenException();
    try { await this.revokeInvitationUC.execute({ id, organizationId: user.organizationId }); return { ok: true }; }
    catch (e) { if (e instanceof InvitationNotFoundError) throw new NotFoundException(); if (e instanceof ForbiddenOrgError) throw new NotFoundException(); throw e; }
  }

  @Public() @Post('invitations/:token/accept')
  async accept(@Param('token') token: string, @Body() body: { firstName: string; lastName: string; password: string }) {
    try { return await this.acceptInvitationUC.execute({ token, firstName: body.firstName, lastName: body.lastName, password: body.password }); }
    catch (e) {
      if (e instanceof InvitationNotFoundError || e instanceof InvitationInvalidError) throw new GoneException('invitation invalide ou expirée');
      if (e instanceof EmailAlreadyUsedError) throw new ConflictException('email déjà utilisé'); throw e;
    }
  }
}
