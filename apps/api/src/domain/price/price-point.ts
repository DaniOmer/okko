export interface PricePointSnapshot {
  id: string;
  cropId: string;
  market: string;
  date: string;
  price: number;
  unit: string;
  currency: string;
}

interface CreateProps {
  id: string;
  cropId: string;
  market: string;
  date: string;
  price: number;
  unit: string;
  currency: string;
}

export class PricePoint {
  private constructor(
    private readonly _id: string,
    private readonly _cropId: string,
    private readonly _market: string,
    private readonly _date: string,
    private readonly _price: number,
    private readonly _unit: string,
    private readonly _currency: string,
  ) {}

  static create(props: CreateProps): PricePoint {
    return new PricePoint(props.id, props.cropId, props.market, props.date, props.price, props.unit, props.currency);
  }

  get id(): string { return this._id; }
  get cropId(): string { return this._cropId; }
  get market(): string { return this._market; }
  get date(): string { return this._date; }
  get price(): number { return this._price; }
  get unit(): string { return this._unit; }
  get currency(): string { return this._currency; }

  toSnapshot(): PricePointSnapshot {
    return {
      id: this._id, cropId: this._cropId, market: this._market, date: this._date,
      price: this._price, unit: this._unit, currency: this._currency,
    };
  }

  static fromSnapshot(s: PricePointSnapshot): PricePoint {
    return new PricePoint(s.id, s.cropId, s.market, s.date, s.price, s.unit, s.currency);
  }
}
