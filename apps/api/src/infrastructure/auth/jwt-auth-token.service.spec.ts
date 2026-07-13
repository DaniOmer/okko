import { JwtService } from '@nestjs/jwt';
import { JwtAuthTokenService } from './jwt-auth-token.service';

describe('JwtAuthTokenService', () => {
  const svc = new JwtAuthTokenService(new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }));
  it('signe puis vérifie le payload', () => {
    const token = svc.sign({ sub: 'u1', email: 'a@b.c', role: 'admin', organizationId: 'o1' });
    const payload = svc.verify(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('admin');
    expect(payload.organizationId).toBe('o1');
  });
  it('rejette un token trafiqué', () => {
    expect(() => svc.verify('pas.un.jwt')).toThrow();
  });
});
