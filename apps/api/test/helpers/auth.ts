import { TestingModuleBuilder } from '@nestjs/testing';
import { AuthGuard } from '../../src/presentation/auth/auth.guard';

/** Bypass l'authentification en injectant un superadmin de test dans la requête. */
export function asSuperadmin(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder.overrideGuard(AuthGuard).useValue({
    canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
      ctx.switchToHttp().getRequest().user = { sub: 'test-super', email: 'super@okko.dev', role: 'superadmin', organizationId: null };
      return true;
    },
  });
}
