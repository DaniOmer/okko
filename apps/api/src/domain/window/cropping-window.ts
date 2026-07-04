import { TechnicalOperation, TechnicalOperationJSON } from './technical-operation';

export interface CroppingWindowSnapshot {
  id: string;
  cropId: string;
  zoneId: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired: boolean;
  operations: TechnicalOperationJSON[];
  notes?: string;
}

interface CreateProps {
  id: string;
  cropId: string;
  zoneId: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired?: boolean;
  operations?: TechnicalOperation[];
  notes?: string;
}

export class CroppingWindow {
  private constructor(
    private readonly _id: string,
    private readonly _cropId: string,
    private readonly _zoneId: string,
    private readonly _season: string,
    private readonly _sowingStart: string | undefined,
    private readonly _sowingEnd: string | undefined,
    private readonly _irrigationRequired: boolean,
    private readonly _operations: TechnicalOperation[],
    private readonly _notes: string | undefined,
  ) {}

  static create(props: CreateProps): CroppingWindow {
    return new CroppingWindow(
      props.id, props.cropId, props.zoneId, props.season, props.sowingStart, props.sowingEnd,
      props.irrigationRequired ?? false, props.operations ?? [], props.notes,
    );
  }

  get id(): string { return this._id; }
  get cropId(): string { return this._cropId; }
  get zoneId(): string { return this._zoneId; }
  get season(): string { return this._season; }
  get sowingStart(): string | undefined { return this._sowingStart; }
  get sowingEnd(): string | undefined { return this._sowingEnd; }
  get irrigationRequired(): boolean { return this._irrigationRequired; }
  get operations(): TechnicalOperation[] { return [...this._operations]; }
  get notes(): string | undefined { return this._notes; }

  toSnapshot(): CroppingWindowSnapshot {
    return {
      id: this._id, cropId: this._cropId, zoneId: this._zoneId, season: this._season,
      sowingStart: this._sowingStart, sowingEnd: this._sowingEnd,
      irrigationRequired: this._irrigationRequired,
      operations: this._operations.map((o) => o.toJSON()),
      notes: this._notes,
    };
  }

  static fromSnapshot(s: CroppingWindowSnapshot): CroppingWindow {
    return new CroppingWindow(
      s.id, s.cropId, s.zoneId, s.season, s.sowingStart, s.sowingEnd, s.irrigationRequired,
      s.operations.map((j) => TechnicalOperation.fromJSON(j)), s.notes,
    );
  }
}
