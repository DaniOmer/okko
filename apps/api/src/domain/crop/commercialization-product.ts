export interface CommercializationProductJSON {
  form: string;
  saleUnits: string[];
  outlets: string[];
}

interface CreateProps {
  form: string;
  saleUnits?: string[];
  outlets?: string[];
}

export class CommercializationProduct {
  private constructor(
    private readonly _form: string,
    private readonly _saleUnits: string[],
    private readonly _outlets: string[],
  ) {}

  static create(props: CreateProps): CommercializationProduct {
    return new CommercializationProduct(props.form, props.saleUnits ?? [], props.outlets ?? []);
  }

  get form(): string { return this._form; }
  get saleUnits(): string[] { return [...this._saleUnits]; }
  get outlets(): string[] { return [...this._outlets]; }

  toJSON(): CommercializationProductJSON {
    return { form: this._form, saleUnits: [...this._saleUnits], outlets: [...this._outlets] };
  }

  static fromJSON(json: CommercializationProductJSON): CommercializationProduct {
    return new CommercializationProduct(json.form, [...(json.saleUnits ?? [])], [...(json.outlets ?? [])]);
  }
}
