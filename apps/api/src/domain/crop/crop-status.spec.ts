import { CropStatus, assertCanTransition, CropStatusError } from './crop-status';

describe('CropStatus transitions', () => {
  it('autorise DRAFT -> PUBLISHED', () => {
    expect(() => assertCanTransition(CropStatus.DRAFT, CropStatus.PUBLISHED)).not.toThrow();
  });

  it('autorise PUBLISHED -> ARCHIVED', () => {
    expect(() => assertCanTransition(CropStatus.PUBLISHED, CropStatus.ARCHIVED)).not.toThrow();
  });

  it('autorise DRAFT -> ARCHIVED (archivage depuis brouillon)', () => {
    expect(() => assertCanTransition(CropStatus.DRAFT, CropStatus.ARCHIVED)).not.toThrow();
  });

  it('autorise ARCHIVED -> DRAFT (désarchivage)', () => {
    expect(() => assertCanTransition(CropStatus.ARCHIVED, CropStatus.DRAFT)).not.toThrow();
  });

  it('interdit PUBLISHED -> DRAFT', () => {
    expect(() => assertCanTransition(CropStatus.PUBLISHED, CropStatus.DRAFT)).toThrow(CropStatusError);
  });

  it('interdit ARCHIVED -> PUBLISHED', () => {
    expect(() => assertCanTransition(CropStatus.ARCHIVED, CropStatus.PUBLISHED)).toThrow(CropStatusError);
  });

  it('autorise PUBLISHED -> PUBLISHED (republication)', () => {
    expect(() => assertCanTransition(CropStatus.PUBLISHED, CropStatus.PUBLISHED)).not.toThrow();
  });

  it('CropStatusError.name est correctement fixé', () => {
    expect.assertions(1);
    try {
      assertCanTransition(CropStatus.PUBLISHED, CropStatus.DRAFT);
    } catch (err) {
      expect((err as Error).name).toBe('CropStatusError');
    }
  });
});
