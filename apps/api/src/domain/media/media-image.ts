export interface MediaImageJSON { key: string; caption?: string; category?: string; }
interface CreateProps { key: string; caption?: string; category?: string; }

export class MediaImage {
  private constructor(
    private readonly _key: string,
    private readonly _caption?: string,
    private readonly _category?: string,
  ) {}
  static create(props: CreateProps): MediaImage { return new MediaImage(props.key, props.caption, props.category); }
  get key(): string { return this._key; }
  get caption(): string | undefined { return this._caption; }
  get category(): string | undefined { return this._category; }
  toJSON(): MediaImageJSON {
    return {
      key: this._key,
      ...(this._caption ? { caption: this._caption } : {}),
      ...(this._category ? { category: this._category } : {}),
    };
  }
  static fromJSON(json: MediaImageJSON): MediaImage { return new MediaImage(json.key, json.caption, json.category); }
}
