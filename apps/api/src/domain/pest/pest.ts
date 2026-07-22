import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';
import { MediaImage, MediaImageJSON } from '../media/media-image';

export interface PestSnapshot {
  id: string;
  name: Record<string, string>;
  type: PestType;
  scientificName?: string;
  family?: string;
  description?: Record<string, string>;
  updatedAt?: string;
  symptoms?: Record<string, string>;
  images: MediaImageJSON[];
  notes?: string;
  metadata: Record<string, unknown>;
}

interface CreateProps {
  id: string;
  name: TranslatableText;
  type: PestType;
  scientificName?: string;
  family?: string;
  description?: TranslatableText;
  symptoms?: TranslatableText;
  images?: MediaImageJSON[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class Pest {
  private constructor(
    private readonly _id: string,
    private readonly _name: TranslatableText,
    private readonly _type: PestType,
    private readonly _scientificName: string | undefined,
    private readonly _family: string | undefined,
    private readonly _description: TranslatableText | undefined,
    private readonly _symptoms: TranslatableText | undefined,
    private readonly _images: MediaImage[],
    private readonly _notes: string | undefined,
    private readonly _metadata: Record<string, unknown>,
  ) {}

  static create(props: CreateProps): Pest {
    return new Pest(
      props.id, props.name, props.type, props.scientificName,
      props.family, props.description,
      props.symptoms,
      (props.images ?? []).map(MediaImage.fromJSON), props.notes, props.metadata ?? {},
    );
  }

  get id(): string { return this._id; }
  get name(): TranslatableText { return this._name; }
  get type(): PestType { return this._type; }
  get scientificName(): string | undefined { return this._scientificName; }
  get family(): string | undefined { return this._family; }
  get description(): TranslatableText | undefined { return this._description; }
  get symptoms(): TranslatableText | undefined { return this._symptoms; }
  get images(): MediaImage[] { return [...this._images]; }
  get notes(): string | undefined { return this._notes; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }

  toSnapshot(): PestSnapshot {
    return {
      id: this._id, name: this._name.toJSON(), type: this._type,
      scientificName: this._scientificName,
      family: this._family,
      description: this._description?.toJSON(),
      symptoms: this._symptoms?.toJSON(),
      images: this._images.map((img) => img.toJSON()),
      notes: this._notes, metadata: { ...this._metadata },
    };
  }

  update(fields: { name: TranslatableText; type: PestType; scientificName?: string; family?: string; description?: TranslatableText; images?: MediaImageJSON[] }): Pest {
    return new Pest(
      this._id,
      fields.name,
      fields.type,
      fields.scientificName,
      fields.family,
      fields.description ?? this._description,
      this._symptoms,
      fields.images !== undefined ? fields.images.map(MediaImage.fromJSON) : this._images,
      this._notes,
      this._metadata,
    );
  }

  static fromSnapshot(s: PestSnapshot): Pest {
    return new Pest(
      s.id, TranslatableText.create(s.name), s.type, s.scientificName,
      s.family,
      s.description ? TranslatableText.create(s.description) : undefined,
      s.symptoms ? TranslatableText.create(s.symptoms) : undefined,
      (s.images ?? []).map(MediaImage.fromJSON), s.notes, { ...s.metadata },
    );
  }
}
