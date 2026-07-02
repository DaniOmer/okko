export class CropStatusError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'CropStatusError';
  }
}

export enum CropStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

const ALLOWED: Record<CropStatus, CropStatus[]> = {
  [CropStatus.DRAFT]: [CropStatus.PUBLISHED],
  [CropStatus.PUBLISHED]: [CropStatus.ARCHIVED],
  [CropStatus.ARCHIVED]: [CropStatus.DRAFT],
};

export function assertCanTransition(from: CropStatus, to: CropStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new CropStatusError(`Illegal transition ${from} -> ${to}`);
  }
}
