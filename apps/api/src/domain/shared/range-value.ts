export class RangeValueError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'RangeValueError';
  }
}

interface RangeValueProps {
  min: number;
  optimal: number;
  max: number;
  unit: string;
}

export class RangeValue {
  private constructor(private readonly props: RangeValueProps) {}

  static create(props: RangeValueProps): RangeValue {
    if (!(props.min <= props.optimal && props.optimal <= props.max)) {
      throw new RangeValueError(
        `Invalid range: expected min <= optimal <= max, got ${props.min}/${props.optimal}/${props.max}`,
      );
    }
    return new RangeValue(props);
  }

  get min(): number { return this.props.min; }
  get optimal(): number { return this.props.optimal; }
  get max(): number { return this.props.max; }
  get unit(): string { return this.props.unit; }

  toJSON(): RangeValueProps {
    return { ...this.props };
  }
}
