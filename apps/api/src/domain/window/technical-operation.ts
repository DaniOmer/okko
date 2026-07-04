import { TranslatableText } from '../shared/translatable-text';
import { OperationType } from './operation-type';

export interface TechnicalOperationJSON {
  type: OperationType;
  label: Record<string, string>;
  timingDays: number;
  inputs: string[];
  notes?: string;
}

interface CreateProps {
  type: OperationType;
  label: TranslatableText;
  timingDays: number;
  inputs?: string[];
  notes?: string;
}

export class TechnicalOperation {
  private constructor(
    private readonly _type: OperationType,
    private readonly _label: TranslatableText,
    private readonly _timingDays: number,
    private readonly _inputs: string[],
    private readonly _notes: string | undefined,
  ) {}

  static create(props: CreateProps): TechnicalOperation {
    return new TechnicalOperation(props.type, props.label, props.timingDays, props.inputs ?? [], props.notes);
  }

  get type(): OperationType { return this._type; }
  get label(): TranslatableText { return this._label; }
  get timingDays(): number { return this._timingDays; }
  get inputs(): string[] { return [...this._inputs]; }
  get notes(): string | undefined { return this._notes; }

  toJSON(): TechnicalOperationJSON {
    return {
      type: this._type, label: this._label.toJSON(), timingDays: this._timingDays,
      inputs: [...this._inputs], notes: this._notes,
    };
  }

  static fromJSON(json: TechnicalOperationJSON): TechnicalOperation {
    return new TechnicalOperation(
      json.type, TranslatableText.create(json.label), json.timingDays, [...json.inputs], json.notes,
    );
  }
}
