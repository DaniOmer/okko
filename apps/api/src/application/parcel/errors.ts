export class BeneficiaryNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Beneficiary ${id} not found`); this.name = 'BeneficiaryNotFoundError'; }
}
export class ParcelNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Parcel ${id} not found`); this.name = 'ParcelNotFoundError'; }
}
