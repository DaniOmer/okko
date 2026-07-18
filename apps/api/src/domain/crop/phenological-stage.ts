import { TranslatableText } from '../shared/translatable-text';

export class PhenologicalStageError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'PhenologicalStageError';
  }
}

export interface PhenologicalStageJSON {
  name: Record<string, string>;
  startDay: number;
  endDay: number;
  order: number;
  description?: string;
  recommendedWork?: string;
}

interface CreateProps {
  name: TranslatableText;
  startDay: number;
  endDay: number;
  order: number;
  description?: string;
  recommendedWork?: string;
}

export class PhenologicalStage {
  private constructor(
    private readonly _name: TranslatableText,
    private readonly _startDay: number,
    private readonly _endDay: number,
    private readonly _order: number,
    private readonly _description: string | undefined,
    private readonly _recommendedWork: string | undefined,
  ) {}

  static create(props: CreateProps): PhenologicalStage {
    if (props.startDay > props.endDay) {
      throw new PhenologicalStageError(`startDay ${props.startDay} > endDay ${props.endDay}`);
    }
    return new PhenologicalStage(props.name, props.startDay, props.endDay, props.order, props.description, props.recommendedWork);
  }

  get name(): TranslatableText { return this._name; }
  get startDay(): number { return this._startDay; }
  get endDay(): number { return this._endDay; }
  get order(): number { return this._order; }
  get description(): string | undefined { return this._description; }
  get recommendedWork(): string | undefined { return this._recommendedWork; }

  toJSON(): PhenologicalStageJSON {
    return { name: this._name.toJSON(), startDay: this._startDay, endDay: this._endDay, order: this._order, description: this._description, recommendedWork: this._recommendedWork };
  }

  static fromJSON(json: PhenologicalStageJSON): PhenologicalStage {
    return new PhenologicalStage(TranslatableText.create(json.name), json.startDay, json.endDay, json.order, json.description, json.recommendedWork);
  }
}
