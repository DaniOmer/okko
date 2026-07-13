import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from './decorators';
import { AUTH_TOKEN_SERVICE, AuthTokenService } from '../../application/auth/auth-token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_TOKEN_SERVICE) private readonly tokens: AuthTokenService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try { req.user = this.tokens.verify(header.slice(7)); return true; }
    catch { throw new UnauthorizedException(); }
  }
}
