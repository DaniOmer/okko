import { OperationType } from '../window/operation-type';

export interface OperationInput { product: string; quantity?: number; unit?: string; cost?: number; }

export interface OperationLogSnapshot {
  id: string;
  organizationId: string;
  campaignId: string;
  type: OperationType;
  date: string;
  inputs: OperationInput[];
  laborCost?: number;
  notes?: string;
  recordedByUserId: string;
  createdAt: string;
}
