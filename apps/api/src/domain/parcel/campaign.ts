export interface CampaignSnapshot {
  id: string;
  organizationId: string;
  parcelId: string;
  cropId?: string;
  customCropName?: string;
  windowId?: string;
  varietyId?: string;
  season: string;
  startDate?: string;
  status: 'ACTIVE' | 'CLOSED';
  notes?: string;
  createdAt: string;
}
