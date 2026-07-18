import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';
import { Provenance } from '../shared/provenance';
import { ResistanceLevel } from './resistance-level';
import { SuitabilityRating } from '../zone/suitability-rating';

export interface VarietyDiseaseResistance { pestId: string; level: ResistanceLevel }
export interface VarietyZoneAdaptation { zoneId: string; rating: SuitabilityRating }

export interface VarietySnapshot {
  id: string;
  cropId: string;
  name: Record<string, string>;
  maturityDays?: number;
  yieldPotential?: ReturnType<RangeValue['toJSON']>;
  traits: string[];
  provenance?: ReturnType<Provenance['toJSON']>;
  diseaseResistances?: VarietyDiseaseResistance[];
  zoneAdaptations?: VarietyZoneAdaptation[];
}

interface CreateVarietyProps {
  id: string;
  cropId: string;
  name: TranslatableText;
  maturityDays?: number;
  yieldPotential?: RangeValue;
  traits?: string[];
  provenance?: Provenance;
  diseaseResistances?: VarietyDiseaseResistance[];
  zoneAdaptations?: VarietyZoneAdaptation[];
}

export class Variety {
  private constructor(
    private readonly _id: string,
    private readonly _cropId: string,
    private readonly _name: TranslatableText,
    private readonly _maturityDays: number | undefined,
    private readonly _yieldPotential: RangeValue | undefined,
    private readonly _traits: string[],
    private readonly _provenance: Provenance | undefined,
    private readonly _diseaseResistances: VarietyDiseaseResistance[],
    private readonly _zoneAdaptations: VarietyZoneAdaptation[],
  ) {}

  static create(props: CreateVarietyProps): Variety {
    return new Variety(
      props.id, props.cropId, props.name, props.maturityDays,
      props.yieldPotential, props.traits ?? [], props.provenance,
      props.diseaseResistances ?? [], props.zoneAdaptations ?? [],
    );
  }

  get id(): string { return this._id; }
  get cropId(): string { return this._cropId; }
  get name(): TranslatableText { return this._name; }
  get maturityDays(): number | undefined { return this._maturityDays; }
  get yieldPotential(): RangeValue | undefined { return this._yieldPotential; }
  get traits(): string[] { return [...this._traits]; }
  get provenance(): Provenance | undefined { return this._provenance; }
  get diseaseResistances(): VarietyDiseaseResistance[] { return this._diseaseResistances.map((r) => ({ ...r })); }
  get zoneAdaptations(): VarietyZoneAdaptation[] { return this._zoneAdaptations.map((r) => ({ ...r })); }

  toSnapshot(): VarietySnapshot {
    return {
      id: this._id,
      cropId: this._cropId,
      name: this._name.toJSON(),
      maturityDays: this._maturityDays,
      yieldPotential: this._yieldPotential?.toJSON(),
      traits: [...this._traits],
      provenance: this._provenance?.toJSON(),
      diseaseResistances: this._diseaseResistances.map((r) => ({ ...r })),
      zoneAdaptations: this._zoneAdaptations.map((r) => ({ ...r })),
    };
  }

  static fromSnapshot(s: VarietySnapshot): Variety {
    return new Variety(
      s.id, s.cropId, TranslatableText.create(s.name), s.maturityDays,
      s.yieldPotential ? RangeValue.create(s.yieldPotential) : undefined,
      [...s.traits],
      s.provenance ? Provenance.fromJSON(s.provenance) : undefined,
      [...(s.diseaseResistances ?? [])].map((r) => ({ ...r })),
      [...(s.zoneAdaptations ?? [])].map((r) => ({ ...r })),
    );
  }
}
