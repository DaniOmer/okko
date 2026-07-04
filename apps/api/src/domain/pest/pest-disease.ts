import { TranslatableText } from '../shared/translatable-text';
import { PestType } from './pest-type';

export interface PestDiseaseSnapshot {
  id: string;
  name: Record<string, string>;
  type: PestType;
  scientificName?: string;
  symptoms?: Record<string, string>;
  photos: string[];
  notes?: string;
  metadata: Record<string, unknown>;
}

interface CreateProps {
  id: string;
  name: TranslatableText;
  type: PestType;
  scientificName?: string;
  symptoms?: TranslatableText;
  photos?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class PestDisease {
  private constructor(
    private readonly _id: string,
    private readonly _name: TranslatableText,
    private readonly _type: PestType,
    private readonly _scientificName: string | undefined,
    private readonly _symptoms: TranslatableText | undefined,
    private readonly _photos: string[],
    private readonly _notes: string | undefined,
    private readonly _metadata: Record<string, unknown>,
  ) {}

  static create(props: CreateProps): PestDisease {
    return new PestDisease(
      props.id, props.name, props.type, props.scientificName, props.symptoms,
      props.photos ?? [], props.notes, props.metadata ?? {},
    );
  }

  get id(): string { return this._id; }
  get name(): TranslatableText { return this._name; }
  get type(): PestType { return this._type; }
  get scientificName(): string | undefined { return this._scientificName; }
  get symptoms(): TranslatableText | undefined { return this._symptoms; }
  get photos(): string[] { return [...this._photos]; }
  get notes(): string | undefined { return this._notes; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }

  toSnapshot(): PestDiseaseSnapshot {
    return {
      id: this._id, name: this._name.toJSON(), type: this._type,
      scientificName: this._scientificName, symptoms: this._symptoms?.toJSON(),
      photos: [...this._photos], notes: this._notes, metadata: { ...this._metadata },
    };
  }

  static fromSnapshot(s: PestDiseaseSnapshot): PestDisease {
    return new PestDisease(
      s.id, TranslatableText.create(s.name), s.type, s.scientificName,
      s.symptoms ? TranslatableText.create(s.symptoms) : undefined,
      [...s.photos], s.notes, { ...s.metadata },
    );
  }
}
