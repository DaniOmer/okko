import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';

export const BENEFICIARY_REPOSITORY = Symbol('BENEFICIARY_REPOSITORY');

export interface BeneficiaryRepository {
  save(b: BeneficiarySnapshot): Promise<void>;
  findById(id: string): Promise<BeneficiarySnapshot | null>;
  listByOrganization(organizationId: string): Promise<BeneficiarySnapshot[]>;
  delete(id: string): Promise<void>;
}
