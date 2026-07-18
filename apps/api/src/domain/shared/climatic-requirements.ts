import { RangeValue } from './range-value';
import { Provenance } from './provenance';

interface ClimaticProps {
  temperature?: RangeValue;
  rainfall?: RangeValue;
  altitude?: RangeValue;
  waterNeed?: string;
  droughtSensitivity?: string;
  provenance?: Provenance;
  notes?: string;
}

export interface ClimaticRequirementsJSON {
  temperature?: ReturnType<RangeValue['toJSON']>;
  rainfall?: ReturnType<RangeValue['toJSON']>;
  altitude?: ReturnType<RangeValue['toJSON']>;
  waterNeed?: string;
  droughtSensitivity?: string;
  provenance?: ReturnType<Provenance['toJSON']>;
  notes?: string;
}

export class ClimaticRequirements {
  private constructor(private readonly props: ClimaticProps) {}

  static create(props: ClimaticProps): ClimaticRequirements {
    return new ClimaticRequirements({ ...props });
  }

  get temperature(): RangeValue | undefined { return this.props.temperature; }
  get rainfall(): RangeValue | undefined { return this.props.rainfall; }
  get altitude(): RangeValue | undefined { return this.props.altitude; }
  get waterNeed(): string | undefined { return this.props.waterNeed; }
  get droughtSensitivity(): string | undefined { return this.props.droughtSensitivity; }
  get provenance(): Provenance | undefined { return this.props.provenance; }
  get notes(): string | undefined { return this.props.notes; }

  toJSON(): ClimaticRequirementsJSON {
    return {
      temperature: this.props.temperature?.toJSON(),
      rainfall: this.props.rainfall?.toJSON(),
      altitude: this.props.altitude?.toJSON(),
      waterNeed: this.props.waterNeed,
      droughtSensitivity: this.props.droughtSensitivity,
      provenance: this.props.provenance?.toJSON(),
      notes: this.props.notes,
    };
  }

  static fromJSON(json: ClimaticRequirementsJSON): ClimaticRequirements {
    return new ClimaticRequirements({
      temperature: json.temperature ? RangeValue.create(json.temperature) : undefined,
      rainfall: json.rainfall ? RangeValue.create(json.rainfall) : undefined,
      altitude: json.altitude ? RangeValue.create(json.altitude) : undefined,
      waterNeed: json.waterNeed,
      droughtSensitivity: json.droughtSensitivity,
      provenance: json.provenance ? Provenance.fromJSON(json.provenance) : undefined,
      notes: json.notes,
    });
  }
}
