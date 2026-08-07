import { BeneficiaryRepository } from './beneficiary.repository';
import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';

export class InMemoryBeneficiaryRepository implements BeneficiaryRepository {
  private store = new Map<string, BeneficiarySnapshot>();
  async save(b: BeneficiarySnapshot): Promise<void> { this.store.set(b.id, b); }
  async findById(id: string): Promise<BeneficiarySnapshot | null> { return this.store.get(id) ?? null; }
  async listByOrganization(organizationId: string): Promise<BeneficiarySnapshot[]> {
    return [...this.store.values()].filter((b) => b.organizationId === organizationId);
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
