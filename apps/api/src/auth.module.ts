import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { UuidIdGenerator } from './infrastructure/uuid-id-generator';
import { SystemClock } from './infrastructure/system-clock';
import { CLOCK } from './application/shared/clock';
import { USER_REPOSITORY, ORGANIZATION_REPOSITORY, AUTH_IDENTITY_REPOSITORY, INVITATION_REPOSITORY } from './application/auth/repositories';
import { PASSWORD_HASHER } from './application/auth/password-hasher';
import { AUTH_TOKEN_SERVICE } from './application/auth/auth-token.service';
import { NOTIFICATION_PORT } from './application/notification/notification-port';
import { PrismaUserRepository } from './infrastructure/auth/prisma-user.repository';
import { PrismaOrganizationRepository } from './infrastructure/auth/prisma-organization.repository';
import { PrismaAuthIdentityRepository } from './infrastructure/auth/prisma-auth-identity.repository';
import { PrismaInvitationRepository } from './infrastructure/auth/prisma-invitation.repository';
import { BcryptPasswordHasher } from './infrastructure/auth/bcrypt-password-hasher';
import { JwtAuthTokenService } from './infrastructure/auth/jwt-auth-token.service';
import { BrevoEmailNotificationSender } from './infrastructure/notification/brevo-email-notification-sender';
import { RegisterUseCase } from './application/auth/register.use-case';
import { LoginUseCase } from './application/auth/login.use-case';
import { GetMeUseCase } from './application/auth/get-me.use-case';
import { CreateInvitationUseCase } from './application/auth/create-invitation.use-case';
import { ListInvitationsUseCase } from './application/auth/list-invitations.use-case';
import { RevokeInvitationUseCase } from './application/auth/revoke-invitation.use-case';
import { AcceptInvitationUseCase } from './application/auth/accept-invitation.use-case';
import { AuthController } from './presentation/auth/auth.controller';
import { AuthGuard } from './presentation/auth/auth.guard';
import { RolesGuard } from './presentation/auth/roles.guard';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
    return 'dev-secret';
  }
  return secret;
}

@Module({
  imports: [JwtModule.register({ secret: resolveJwtSecret(), signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } })],
  controllers: [AuthController],
  providers: [
    PrismaService, UuidIdGenerator,
    { provide: CLOCK, useClass: SystemClock },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: ORGANIZATION_REPOSITORY, useClass: PrismaOrganizationRepository },
    { provide: AUTH_IDENTITY_REPOSITORY, useClass: PrismaAuthIdentityRepository },
    { provide: INVITATION_REPOSITORY, useClass: PrismaInvitationRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: AUTH_TOKEN_SERVICE, useClass: JwtAuthTokenService },
    { provide: NOTIFICATION_PORT, useClass: BrevoEmailNotificationSender },
    AuthGuard, RolesGuard,
    { provide: RegisterUseCase, useFactory: (u, o, i, h, t, c, g) => new RegisterUseCase(u, o, i, h, t, c, g), inject: [USER_REPOSITORY, ORGANIZATION_REPOSITORY, AUTH_IDENTITY_REPOSITORY, PASSWORD_HASHER, AUTH_TOKEN_SERVICE, CLOCK, UuidIdGenerator] },
    { provide: LoginUseCase, useFactory: (u, i, h, t) => new LoginUseCase(u, i, h, t), inject: [USER_REPOSITORY, AUTH_IDENTITY_REPOSITORY, PASSWORD_HASHER, AUTH_TOKEN_SERVICE] },
    { provide: GetMeUseCase, useFactory: (u) => new GetMeUseCase(u), inject: [USER_REPOSITORY] },
    { provide: CreateInvitationUseCase, useFactory: (inv, o, u, n, c, g) => new CreateInvitationUseCase(inv, o, u, n, c, g), inject: [INVITATION_REPOSITORY, ORGANIZATION_REPOSITORY, USER_REPOSITORY, NOTIFICATION_PORT, CLOCK, UuidIdGenerator] },
    { provide: ListInvitationsUseCase, useFactory: (inv) => new ListInvitationsUseCase(inv), inject: [INVITATION_REPOSITORY] },
    { provide: RevokeInvitationUseCase, useFactory: (inv) => new RevokeInvitationUseCase(inv), inject: [INVITATION_REPOSITORY] },
    { provide: AcceptInvitationUseCase, useFactory: (inv, u, i, h, t, c, g) => new AcceptInvitationUseCase(inv, u, i, h, t, c, g), inject: [INVITATION_REPOSITORY, USER_REPOSITORY, AUTH_IDENTITY_REPOSITORY, PASSWORD_HASHER, AUTH_TOKEN_SERVICE, CLOCK, UuidIdGenerator] },
  ],
  exports: [AUTH_TOKEN_SERVICE, AuthGuard, RolesGuard],
})
export class AuthModule {}
