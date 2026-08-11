import { OperationLogSnapshot } from '../../domain/parcel/operation-log';

export const OPERATION_LOG_REPOSITORY = Symbol('OPERATION_LOG_REPOSITORY');

export interface OperationLogRepository {
  save(o: OperationLogSnapshot): Promise<void>;
  findById(id: string): Promise<OperationLogSnapshot | null>;
  listByCampaign(organizationId: string, campaignId: string): Promise<OperationLogSnapshot[]>;
  delete(id: string): Promise<void>;
}
