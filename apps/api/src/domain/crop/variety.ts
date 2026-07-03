import { TranslatableText } from '../shared/translatable-text';
import { RangeValue } from '../shared/range-value';
import { Provenance } from '../shared/provenance';

export interface VarietySnapshot {
  id: string;
  cropId: string;
  name: Record<string, string>;
  maturityDays?: number;
  yieldPotential?: ReturnType<RangeValue['toJSON']>;
  traits: string[];
  provenance?: ReturnType<Provenance['toJSON']>;
}

interface CreateVarietyProps {
  id: string;
  cropId: string;
  name: TranslatableText;
  maturityDays?: number;
  yieldPotential?: RangeValue;
  traits?: string[];
  provenance?: Provenance;
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
  ) {}

  static create(props: CreateVarietyProps): Variety {
    return new Variety(
      props.id, props.cropId, props.name, props.maturityDays,
      props.yieldPotential, props.traits ?? [], props.provenance,
    );
  }

  get id(): string { return this._id; }
  get cropId(): string { return this._cropId; }
  get name(): TranslatableText { return this._name; }
  get maturityDays(): number | undefined { return this._maturityDays; }
  get yieldPotential(): RangeValue | undefined { return this._yieldPotential; }
  get traits(): string[] { return [...this._traits]; }
  get provenance(): Provenance | undefined { return this._provenance; }

  toSnapshot(): VarietySnapshot {
    return {
      id: this._id,
      cropId: this._cropId,
      name: this._name.toJSON(),
      maturityDays: this._maturityDays,
      yieldPotential: this._yieldPotential?.toJSON(),
      traits: [...this._traits],
      provenance: this._provenance?.toJSON(),
    };
  }

  static fromSnapshot(s: VarietySnapshot): Variety {
    return new Variety(
      s.id, s.cropId, TranslatableText.create(s.name), s.maturityDays,
      s.yieldPotential ? RangeValue.create(s.yieldPotential) : undefined,
      [...s.traits],
      s.provenance ? Provenance.fromJSON(s.provenance) : undefined,
    );
  }
}
