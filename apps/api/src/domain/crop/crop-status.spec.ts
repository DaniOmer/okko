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

  it('autorise ARCHIVED -> DRAFT', () => {
    expect(() => assertCanTransition(CropStatus.ARCHIVED, CropStatus.DRAFT)).not.toThrow();
  });

  it('interdit PUBLISHED -> DRAFT', () => {
    expect(() => assertCanTransition(CropStatus.PUBLISHED, CropStatus.DRAFT)).toThrow(CropStatusError);
  });

  it('interdit ARCHIVED -> PUBLISHED', () => {
    expect(() => assertCanTransition(CropStatus.ARCHIVED, CropStatus.PUBLISHED)).toThrow(CropStatusError);
  });

  it('CropStatusError.name est correctement fixé', () => {
    expect.assertions(1);
    try {
      assertCanTransition(CropStatus.DRAFT, CropStatus.ARCHIVED);
    } catch (err) {
      expect((err as Error).name).toBe('CropStatusError');
    }
  });
});
