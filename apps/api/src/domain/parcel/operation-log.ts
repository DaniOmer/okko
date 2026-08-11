import { OperationType } from '../window/operation-type';
import { MediaImageJSON } from '../media/media-image';

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
  photos?: MediaImageJSON[];
  gpsLat?: number;
  gpsLng?: number;
  recordedByUserId: string;
  createdAt: string;
}
