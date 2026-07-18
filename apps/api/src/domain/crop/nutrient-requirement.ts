export enum NutrientBasis {
  PER_HECTARE = 'PER_HECTARE',
  PER_TONNE = 'PER_TONNE',
}

export interface NutrientRequirementJSON {
  nutrient: string;
  amount: number;
  unit: string;
  basis: NutrientBasis;
  stage?: string;
  method?: string;
}

interface CreateProps {
  nutrient: string;
  amount: number;
  unit: string;
  basis: NutrientBasis;
  stage?: string;
  method?: string;
}

export class NutrientRequirement {
  private constructor(
    private readonly _nutrient: string,
    private readonly _amount: number,
    private readonly _unit: string,
    private readonly _basis: NutrientBasis,
    private readonly _stage: string | undefined,
    private readonly _method: string | undefined,
  ) {}

  static create(props: CreateProps): NutrientRequirement {
    return new NutrientRequirement(props.nutrient, props.amount, props.unit, props.basis, props.stage, props.method);
  }

  get nutrient(): string { return this._nutrient; }
  get amount(): number { return this._amount; }
  get unit(): string { return this._unit; }
  get basis(): NutrientBasis { return this._basis; }
  get stage(): string | undefined { return this._stage; }
  get method(): string | undefined { return this._method; }

  toJSON(): NutrientRequirementJSON {
    return { nutrient: this._nutrient, amount: this._amount, unit: this._unit, basis: this._basis, stage: this._stage, method: this._method };
  }

  static fromJSON(json: NutrientRequirementJSON): NutrientRequirement {
    return new NutrientRequirement(json.nutrient, json.amount, json.unit, json.basis, json.stage, json.method);
  }
}
