export enum InputLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class YieldReferenceError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'YieldReferenceError';
  }
}

export interface YieldReferenceJSON {
  inputLevel: InputLevel;
  min: number;
  average: number;
  potential: number;
  unit: string;
  zoneId?: string;
}

interface CreateProps {
  inputLevel: InputLevel;
  min: number;
  average: number;
  potential: number;
  unit: string;
  zoneId?: string;
}

export class YieldReference {
  private constructor(
    private readonly _inputLevel: InputLevel,
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
    return new YieldReference(props.inputLevel, props.min, props.average, props.potential, props.unit, props.zoneId);
  }

  get inputLevel(): InputLevel { return this._inputLevel; }
  get min(): number { return this._min; }
  get average(): number { return this._average; }
  get potential(): number { return this._potential; }
  get unit(): string { return this._unit; }
  get zoneId(): string | undefined { return this._zoneId; }

  toJSON(): YieldReferenceJSON {
    return {
      inputLevel: this._inputLevel, min: this._min, average: this._average,
      potential: this._potential, unit: this._unit, zoneId: this._zoneId,
    };
  }

  static fromJSON(json: YieldReferenceJSON): YieldReference {
    return new YieldReference(json.inputLevel, json.min, json.average, json.potential, json.unit, json.zoneId);
  }
}
