export interface ParcelSnapshot {
  id: string;
  organizationId: string;
  name: string;
  beneficiaryId?: string;
  zoneId?: string;
  gpsLat?: number;
  gpsLng?: number;
  locality?: string;
  areaHectares?: number;
  notes?: string;
  createdAt: string;
}
