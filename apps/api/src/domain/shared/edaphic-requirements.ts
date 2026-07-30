import { RangeValue } from './range-value';
import { Provenance } from './provenance';

interface EdaphicProps {
  ph?: RangeValue;
  texture?: string;
  drainage?: string;
  soilDepth?: RangeValue;
  fertilityRequirement?: string;
  salinityTolerance?: string;
  provenance?: Provenance;
  notes?: string;
}

export interface EdaphicRequirementsJSON {
  ph?: ReturnType<RangeValue['toJSON']>;
  texture?: string;
  drainage?: string;
  soilDepth?: ReturnType<RangeValue['toJSON']>;
  fertilityRequirement?: string;
  salinityTolerance?: string;
  provenance?: ReturnType<Provenance['toJSON']>;
  notes?: string;
}

export class EdaphicRequirements {
  private constructor(private readonly props: EdaphicProps) {}

  static create(props: EdaphicProps): EdaphicRequirements {
    return new EdaphicRequirements({ ...props });
  }

  get ph(): RangeValue | undefined { return this.props.ph; }
  get texture(): string | undefined { return this.props.texture; }
  get drainage(): string | undefined { return this.props.drainage; }
  get soilDepth(): RangeValue | undefined { return this.props.soilDepth; }
  get fertilityRequirement(): string | undefined { return this.props.fertilityRequirement; }
  get salinityTolerance(): string | undefined { return this.props.salinityTolerance; }
  get provenance(): Provenance | undefined { return this.props.provenance; }
  get notes(): string | undefined { return this.props.notes; }

  toJSON(): EdaphicRequirementsJSON {
    return {
      ph: this.props.ph?.toJSON(),
      texture: this.props.texture,
      drainage: this.props.drainage,
      soilDepth: this.props.soilDepth?.toJSON(),
      fertilityRequirement: this.props.fertilityRequirement,
      salinityTolerance: this.props.salinityTolerance,
      provenance: this.props.provenance?.toJSON(),
      notes: this.props.notes,
    };
  }

  static fromJSON(json: EdaphicRequirementsJSON): EdaphicRequirements {
    return new EdaphicRequirements({
      ph: json.ph ? RangeValue.create(json.ph) : undefined,
      texture: json.texture,
      drainage: json.drainage,
      soilDepth: json.soilDepth ? RangeValue.create(json.soilDepth) : undefined,
      fertilityRequirement: json.fertilityRequirement,
      salinityTolerance: json.salinityTolerance,
      provenance: json.provenance ? Provenance.fromJSON(json.provenance) : undefined,
      notes: json.notes,
    });
  }
}
