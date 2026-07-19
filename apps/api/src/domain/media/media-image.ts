export interface MediaImageJSON { key: string; caption?: string; }
interface CreateProps { key: string; caption?: string; }

export class MediaImage {
  private constructor(private readonly _key: string, private readonly _caption?: string) {}
  static create(props: CreateProps): MediaImage { return new MediaImage(props.key, props.caption); }
  get key(): string { return this._key; }
  get caption(): string | undefined { return this._caption; }
  toJSON(): MediaImageJSON { return this._caption ? { key: this._key, caption: this._caption } : { key: this._key }; }
  static fromJSON(json: MediaImageJSON): MediaImage { return new MediaImage(json.key, json.caption); }
}
