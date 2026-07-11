export enum InputType {
  CHEMICAL = 'CHEMICAL',
  ORGANIC = 'ORGANIC',
  MIXED = 'MIXED',
}

export class YieldReferenceError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'YieldReferenceError';
  }
}

export interface YieldReferenceJSON {
  inputType: InputType;
  min: number;
  average: number;
  potential: number;
  unit: string;
  zoneId?: string;
}

interface CreateProps {
  inputType: InputType;
  min: number;
  average: number;
  potential: number;
  unit: string;
  zoneId?: string;
}

export class YieldReference {
  private constructor(
    private readonly _inputType: InputType,
    private readonly _min: number,
    private readonly _average: number,
    private readonly _potential: number,
    private readonly _unit: string,
    private readonly _zoneId: string | undefined,
  ) {}

  static create(props: CreateProps): YieldReference {
    if (!(props.min <= props.average && props.average <= props.potential)) {
      throw new YieldReferenceError(`Invalid yield: expected min <= average <= potential, got ${props.min}/${props.average}/${props.potential}`);
    }
    return new YieldReference(props.inputType, props.min, props.average, props.potential, props.unit, props.zoneId);
  }

  get inputType(): InputType { return this._inputType; }
  get min(): number { return this._min; }
  get average(): number { return this._average; }
  get potential(): number { return this._potential; }
  get unit(): string { return this._unit; }
  get zoneId(): string | undefined { return this._zoneId; }

  toJSON(): YieldReferenceJSON {
    return {
      inputType: this._inputType, min: this._min, average: this._average,
      potential: this._potential, unit: this._unit, zoneId: this._zoneId,
    };
  }

  static fromJSON(json: YieldReferenceJSON): YieldReference {
    return new YieldReference(json.inputType, json.min, json.average, json.potential, json.unit, json.zoneId);
  }
}
