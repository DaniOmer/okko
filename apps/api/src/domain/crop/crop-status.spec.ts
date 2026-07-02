import { CropStatus, assertCanTransition, CropStatusError } from './crop-status';

describe('CropStatus transitions', () => {
  it('autorise DRAFT -> PUBLISHED', () => {
    expect(() => assertCanTransition(CropStatus.DRAFT, CropStatus.PUBLISHED)).not.toThrow();
  });

  it('autorise PUBLISHED -> ARCHIVED', () => {
    expect(() => assertCanTransition(CropStatus.PUBLISHED, CropStatus.ARCHIVED)).not.toThrow();
  });

  it('interdit DRAFT -> ARCHIVED', () => {
    expect(() => assertCanTransition(CropStatus.DRAFT, CropStatus.ARCHIVED)).toThrow(CropStatusError);
  });
});
