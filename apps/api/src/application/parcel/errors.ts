export class BeneficiaryNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Beneficiary ${id} not found`); this.name = 'BeneficiaryNotFoundError'; }
}
export class ParcelNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Parcel ${id} not found`); this.name = 'ParcelNotFoundError'; }
}
export class CampaignNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Campaign ${id} not found`); this.name = 'CampaignNotFoundError'; }
}
export class OperationLogNotFoundError extends Error {
  constructor(public readonly id: string) { super(`OperationLog ${id} not found`); this.name = 'OperationLogNotFoundError'; }
}
export class MissingCropError extends Error {
  constructor() { super('A campaign requires either cropId or customCropName'); this.name = 'MissingCropError'; }
}
