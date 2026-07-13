import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, AuthTokenPayload } from '../../application/auth/types';

export type AuthUser = AuthTokenPayload;
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
