import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators';
import { OperationLogController } from './operation-log.controller';

const reflector = new Reflector();
const READ = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'];
const WRITE = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

describe('OperationLogController — rôles', () => {
  it('lecture = 4 rôles', () => { expect(reflector.get<string[]>(ROLES_KEY, OperationLogController.prototype.list)).toEqual(READ); });
  it('écriture = 3 rôles', () => {
    for (const m of [OperationLogController.prototype.create, OperationLogController.prototype.update, OperationLogController.prototype.remove]) {
      expect(reflector.get<string[]>(ROLES_KEY, m)).toEqual(WRITE);
    }
  });
});
