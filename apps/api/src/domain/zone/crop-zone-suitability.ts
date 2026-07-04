import { SuitabilityRating } from './suitability-rating';
import { Provenance } from '../shared/provenance';

export interface CropZoneSuitabilitySnapshot {
  cropId: string;
  zoneId: string;
  rating: SuitabilityRating;
  justification?: string;
  provenance?: ReturnType<Provenance['toJSON']>;
}

interface CreateProps {
  cropId: string;
  zoneId: string;
  rating: SuitabilityRating;
  justification?: string;
  provenance?: Provenance;
}

export class CropZoneSuitability {
  private constructor(
    private readonly _cropId: string,
    private readonly _zoneId: string,
    private readonly _rating: SuitabilityRating,
    private readonly _justification: string | undefined,
    private readonly _provenance: Provenance | undefined,
  ) {}

  static create(props: CreateProps): CropZoneSuitability {
    return new CropZoneSuitability(
      props.cropId, props.zoneId, props.rating, props.justification, props.provenance,
    );
  }

  get cropId(): string { return this._cropId; }
  get zoneId(): string { return this._zoneId; }
  get rating(): SuitabilityRating { return this._rating; }
  get justification(): string | undefined { return this._justification; }
  get provenance(): Provenance | undefined { return this._provenance; }

  toSnapshot(): CropZoneSuitabilitySnapshot {
    return {
      cropId: this._cropId,
      zoneId: this._zoneId,
      rating: this._rating,
      justification: this._justification,
      provenance: this._provenance?.toJSON(),
    };
  }

  static fromSnapshot(s: CropZoneSuitabilitySnapshot): CropZoneSuitability {
    return new CropZoneSuitability(
      s.cropId, s.zoneId, s.rating, s.justification,
      s.provenance ? Provenance.fromJSON(s.provenance) : undefined,
    );
  }
}
