import { TranslatableText } from '../shared/translatable-text';
import { ControlCategory } from './control-category';

export interface ControlMethodJSON {
  category: ControlCategory;
  description: Record<string, string>;
  inputs: string[];
}

interface CreateProps {
  category: ControlCategory;
  description: TranslatableText;
  inputs?: string[];
}

export class ControlMethod {
  private constructor(
    private readonly _category: ControlCategory,
    private readonly _description: TranslatableText,
    private readonly _inputs: string[],
  ) {}

  static create(props: CreateProps): ControlMethod {
    return new ControlMethod(props.category, props.description, props.inputs ?? []);
  }

  get category(): ControlCategory { return this._category; }
  get description(): TranslatableText { return this._description; }
  get inputs(): string[] { return [...this._inputs]; }

  toJSON(): ControlMethodJSON {
    return { category: this._category, description: this._description.toJSON(), inputs: [...this._inputs] };
  }

  static fromJSON(json: ControlMethodJSON): ControlMethod {
    return new ControlMethod(json.category, TranslatableText.create(json.description), [...json.inputs]);
  }
}
