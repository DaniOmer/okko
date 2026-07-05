import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';

export interface ZoneSnapshot {
  id: string;
  name: Record<string, string>;
  country: string;
  koppen?: string;
  altitude?: ReturnType<RangeValue['toJSON']>;
  annualRainfall?: ReturnType<RangeValue['toJSON']>;
  notes?: string;
  metadata: Record<string, unknown>;
}

interface CreateZoneProps {
  id: string;
  name: TranslatableText;
  country: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class AgroEcologicalZone {
  private constructor(
    private readonly _id: string,
    private readonly _name: TranslatableText,
    private readonly _country: string,
    private readonly _koppen: string | undefined,
    private readonly _altitude: RangeValue | undefined,
    private readonly _annualRainfall: RangeValue | undefined,
    private readonly _notes: string | undefined,
    private readonly _metadata: Record<string, unknown>,
  ) {}

  static create(props: CreateZoneProps): AgroEcologicalZone {
    return new AgroEcologicalZone(
      props.id, props.name, props.country, props.koppen, props.altitude,
      props.annualRainfall, props.notes, props.metadata ?? {},
    );
  }

  get id(): string { return this._id; }
  get name(): TranslatableText { return this._name; }
  get country(): string { return this._country; }
  get koppen(): string | undefined { return this._koppen; }
  get altitude(): RangeValue | undefined { return this._altitude; }
  get annualRainfall(): RangeValue | undefined { return this._annualRainfall; }
  get notes(): string | undefined { return this._notes; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }

  toSnapshot(): ZoneSnapshot {
    return {
      id: this._id,
      name: this._name.toJSON(),
      country: this._country,
      koppen: this._koppen,
      altitude: this._altitude?.toJSON(),
      annualRainfall: this._annualRainfall?.toJSON(),
      notes: this._notes,
      metadata: { ...this._metadata },
    };
  }

  update(fields: { name: TranslatableText; country: string; koppen?: string }): AgroEcologicalZone {
    return new AgroEcologicalZone(
      this._id,
      fields.name,
      fields.country,
      fields.koppen,
      this._altitude,
      this._annualRainfall,
      this._notes,
      this._metadata,
    );
  }

  static fromSnapshot(s: ZoneSnapshot): AgroEcologicalZone {
    return new AgroEcologicalZone(
      s.id, TranslatableText.create(s.name), s.country, s.koppen,
      s.altitude ? RangeValue.create(s.altitude) : undefined,
      s.annualRainfall ? RangeValue.create(s.annualRainfall) : undefined,
      s.notes, { ...s.metadata },
    );
  }
}
