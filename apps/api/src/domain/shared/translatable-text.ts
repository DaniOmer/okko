export class TranslatableTextError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'TranslatableTextError';
  }
}

export class TranslatableText {
  private constructor(
    private readonly map: Record<string, string>,
    private readonly defaultLocale: string,
  ) {}

  static create(map: Record<string, string>, defaultLocale = 'fr'): TranslatableText {
    if (!map[defaultLocale]) {
      throw new TranslatableTextError(`Missing default locale "${defaultLocale}"`);
    }
    return new TranslatableText({ ...map }, defaultLocale);
  }

  get(locale: string): string | undefined {
    return this.map[locale];
  }

  getOrDefault(locale: string): string {
    return this.map[locale] ?? this.map[this.defaultLocale];
  }

  toJSON(): Record<string, string> {
    return { ...this.map };
  }
}
