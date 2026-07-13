import { AuthTokenPayload } from './types';
export const AUTH_TOKEN_SERVICE = Symbol('AUTH_TOKEN_SERVICE');
export interface AuthTokenService {
  sign(payload: AuthTokenPayload): string;
  verify(token: string): AuthTokenPayload;
}
