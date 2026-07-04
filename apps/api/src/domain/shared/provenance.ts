export enum ProvenanceSource {
  MANUAL = 'MANUAL',
  EXTERNAL = 'EXTERNAL',
}

type Confidence = 'low' | 'medium' | 'high';

export interface ProvenanceProps {
  source: ProvenanceSource;
  sourceRef?: string;
  capturedAt: string;
  validatedBy?: string;
  confidence?: Confidence;
}

export class Provenance {
  private constructor(private readonly props: ProvenanceProps) {}

  static manual(author: string, capturedAt = new Date(0).toISOString()): Provenance {
    return new Provenance({
      source: ProvenanceSource.MANUAL,
      validatedBy: author,
      capturedAt,
      confidence: 'high',
    });
  }

  static external(props: { sourceRef: string; capturedAt: string; confidence?: Confidence }): Provenance {
    return new Provenance({ source: ProvenanceSource.EXTERNAL, ...props });
  }

  static fromJSON(props: ProvenanceProps): Provenance {
    return new Provenance({ ...props });
  }

  get source(): ProvenanceSource { return this.props.source; }
  get sourceRef(): string | undefined { return this.props.sourceRef; }
  get validatedBy(): string | undefined { return this.props.validatedBy; }

  toJSON(): ProvenanceProps { return { ...this.props }; }
}
