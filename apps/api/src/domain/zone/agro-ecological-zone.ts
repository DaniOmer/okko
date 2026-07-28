import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';
import { MediaImage, MediaImageJSON } from '../media/media-image';

type RangeJSON = ReturnType<RangeValue['toJSON']>;

export interface ZoneSnapshot {
  id: string;
  name: Record<string, string>;
  country: string;
  code?: string;
  region?: string;
  description?: Record<string, string>;
  climateType?: string;
  koppen?: string;
  altitude?: RangeJSON;
  annualRainfall?: RangeJSON;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  images: MediaImageJSON[];
}

interface ZoneProps {
  id: string;
  name: TranslatableText;
  country: string;
  code?: string;
  region?: string;
  description?: TranslatableText;
  climateType?: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  images: MediaImage[];
}

export interface CreateZoneProps {
  id: string;
  name: TranslatableText;
  country: string;
  code?: string;
  region?: string;
  description?: TranslatableText;
  climateType?: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  images?: MediaImageJSON[];
}

export interface UpdateZoneFields {
  name: TranslatableText;
  country: string;
  code?: string;
  region?: string;
  description?: TranslatableText;
  climateType?: string;
  koppen?: string;
  altitude?: RangeValue;
  annualRainfall?: RangeValue;
  meanTemperature?: number;
  meanHumidity?: number;
  rainySeasonStart?: string;
  rainySeasonEnd?: string;
  drySeasonStart?: string;
  drySeasonEnd?: string;
  soilTypes?: string[];
  fertility?: string;
  drainage?: string;
  images?: MediaImageJSON[];
}

export class AgroEcologicalZone {
  private constructor(private readonly p: ZoneProps) {}

  static create(props: CreateZoneProps): AgroEcologicalZone {
    return new AgroEcologicalZone({
      ...props,
      metadata: props.metadata ?? {},
      images: (props.images ?? []).map(MediaImage.fromJSON),
    });
  }

  get id(): string { return this.p.id; }
  get name(): TranslatableText { return this.p.name; }
  get country(): string { return this.p.country; }
  get koppen(): string | undefined { return this.p.koppen; }
  get altitude(): RangeValue | undefined { return this.p.altitude; }
  get annualRainfall(): RangeValue | undefined { return this.p.annualRainfall; }
  get notes(): string | undefined { return this.p.notes; }
  get metadata(): Record<string, unknown> { return { ...this.p.metadata }; }
  get images(): MediaImage[] { return [...this.p.images]; }

  toSnapshot(): ZoneSnapshot {
    return {
      id: this.p.id,
      name: this.p.name.toJSON(),
      country: this.p.country,
      code: this.p.code,
      region: this.p.region,
      description: this.p.description?.toJSON(),
      climateType: this.p.climateType,
      koppen: this.p.koppen,
      altitude: this.p.altitude?.toJSON(),
      annualRainfall: this.p.annualRainfall?.toJSON(),
      meanTemperature: this.p.meanTemperature,
      meanHumidity: this.p.meanHumidity,
      rainySeasonStart: this.p.rainySeasonStart,
      rainySeasonEnd: this.p.rainySeasonEnd,
      drySeasonStart: this.p.drySeasonStart,
      drySeasonEnd: this.p.drySeasonEnd,
      soilTypes: this.p.soilTypes,
      fertility: this.p.fertility,
      drainage: this.p.drainage,
      notes: this.p.notes,
      metadata: { ...this.p.metadata },
      images: this.p.images.map((img) => img.toJSON()),
    };
  }

  update(fields: UpdateZoneFields): AgroEcologicalZone {
    return new AgroEcologicalZone({
      id: this.p.id,
      notes: this.p.notes,
      metadata: this.p.metadata,
      name: fields.name,
      country: fields.country,
      code: fields.code,
      region: fields.region,
      description: fields.description,
      climateType: fields.climateType,
      koppen: fields.koppen,
      altitude: fields.altitude,
      annualRainfall: fields.annualRainfall,
      meanTemperature: fields.meanTemperature,
      meanHumidity: fields.meanHumidity,
      rainySeasonStart: fields.rainySeasonStart,
      rainySeasonEnd: fields.rainySeasonEnd,
      drySeasonStart: fields.drySeasonStart,
      drySeasonEnd: fields.drySeasonEnd,
      soilTypes: fields.soilTypes,
      fertility: fields.fertility,
      drainage: fields.drainage,
      images: fields.images !== undefined ? fields.images.map(MediaImage.fromJSON) : this.p.images,
    });
  }

  static fromSnapshot(s: ZoneSnapshot): AgroEcologicalZone {
    return new AgroEcologicalZone({
      id: s.id,
      name: TranslatableText.create(s.name),
      country: s.country,
      code: s.code,
      region: s.region,
      description: s.description ? TranslatableText.create(s.description) : undefined,
      climateType: s.climateType,
      koppen: s.koppen,
      altitude: s.altitude ? RangeValue.create(s.altitude) : undefined,
      annualRainfall: s.annualRainfall ? RangeValue.create(s.annualRainfall) : undefined,
      meanTemperature: s.meanTemperature,
      meanHumidity: s.meanHumidity,
      rainySeasonStart: s.rainySeasonStart,
      rainySeasonEnd: s.rainySeasonEnd,
      drySeasonStart: s.drySeasonStart,
      drySeasonEnd: s.drySeasonEnd,
      soilTypes: s.soilTypes,
      fertility: s.fertility,
      drainage: s.drainage,
      notes: s.notes,
      metadata: { ...s.metadata },
      images: (s.images ?? []).map(MediaImage.fromJSON),
    });
  }
}
