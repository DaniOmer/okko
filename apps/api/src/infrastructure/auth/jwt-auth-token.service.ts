import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenService } from '../../application/auth/auth-token.service';
import { AuthTokenPayload } from '../../application/auth/types';

@Injectable()
export class JwtAuthTokenService implements AuthTokenService {
  constructor(private readonly jwt: JwtService) {}
  sign(payload: AuthTokenPayload): string { return this.jwt.sign(payload); }
  verify(token: string): AuthTokenPayload {
    const p = this.jwt.verify<AuthTokenPayload & { iat: number; exp: number }>(token);
    return { sub: p.sub, email: p.email, role: p.role, organizationId: p.organizationId };
  }
}
