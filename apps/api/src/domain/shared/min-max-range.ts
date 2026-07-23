export class MinMaxRangeError extends Error {
  constructor(message?: string) { super(message); this.name = 'MinMaxRangeError'; }
}

export interface MinMaxRangeJSON { min: number; max: number; unit?: string; }

export class MinMaxRange {
  private constructor(private readonly props: MinMaxRangeJSON) {}

  static create(props: MinMaxRangeJSON): MinMaxRange {
    if (!(props.min <= props.max)) {
      throw new MinMaxRangeError(`Invalid range: expected min <= max, got ${props.min}/${props.max}`);
    }
    return new MinMaxRange({ min: props.min, max: props.max, ...(props.unit ? { unit: props.unit } : {}) });
  }

  get min(): number { return this.props.min; }
  get max(): number { return this.props.max; }
  get unit(): string | undefined { return this.props.unit; }

  toJSON(): MinMaxRangeJSON { return { ...this.props }; }
  static fromJSON(json: MinMaxRangeJSON): MinMaxRange { return MinMaxRange.create(json); }
}
