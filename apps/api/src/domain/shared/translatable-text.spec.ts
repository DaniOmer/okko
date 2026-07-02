import { TranslatableText, TranslatableTextError } from './translatable-text';

describe('TranslatableText', () => {
  it('retourne la valeur d\'une locale existante', () => {
    const t = TranslatableText.create({ fr: 'Carotte', en: 'Carrot' });
    expect(t.get('en')).toBe('Carrot');
  });

  it('retombe sur la locale par défaut si absente', () => {
    const t = TranslatableText.create({ fr: 'Carotte' });
    expect(t.getOrDefault('wo')).toBe('Carotte');
  });

  it('exige la présence de la locale par défaut', () => {
    expect(() => TranslatableText.create({ en: 'Carrot' }, 'fr'))
      .toThrow(TranslatableTextError);
  });

  it('TranslatableTextError.name est correctement fixé', () => {
    try {
      TranslatableText.create({ en: 'Carrot' }, 'fr');
    } catch (err) {
      expect((err as Error).name).toBe('TranslatableTextError');
    }
  });
});
