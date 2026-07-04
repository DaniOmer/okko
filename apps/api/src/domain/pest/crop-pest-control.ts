import { SusceptibilityLevel } from './susceptibility-level';
import { ControlMethod, ControlMethodJSON } from './control-method';
import { Provenance } from '../shared/provenance';

export interface CropPestControlSnapshot {
  cropId: string;
  pestId: string;
  susceptibility: SusceptibilityLevel;
  sensitiveStages: string[];
  threshold?: string;
  controlMethods: ControlMethodJSON[];
  provenance?: ReturnType<Provenance['toJSON']>;
}

interface CreateProps {
  cropId: string;
  pestId: string;
  susceptibility: SusceptibilityLevel;
  sensitiveStages?: string[];
  threshold?: string;
  controlMethods?: ControlMethod[];
  provenance?: Provenance;
}

export class CropPestControl {
  private constructor(
    private readonly _cropId: string,
    private readonly _pestId: string,
    private readonly _susceptibility: SusceptibilityLevel,
    private readonly _sensitiveStages: string[],
    private readonly _threshold: string | undefined,
    private readonly _controlMethods: ControlMethod[],
    private readonly _provenance: Provenance | undefined,
  ) {}

  static create(props: CreateProps): CropPestControl {
    return new CropPestControl(
      props.cropId, props.pestId, props.susceptibility, props.sensitiveStages ?? [],
      props.threshold, props.controlMethods ?? [], props.provenance,
    );
  }

  get cropId(): string { return this._cropId; }
  get pestId(): string { return this._pestId; }
  get susceptibility(): SusceptibilityLevel { return this._susceptibility; }
  get sensitiveStages(): string[] { return [...this._sensitiveStages]; }
  get threshold(): string | undefined { return this._threshold; }
  get controlMethods(): ControlMethod[] { return [...this._controlMethods]; }
  get provenance(): Provenance | undefined { return this._provenance; }

  toSnapshot(): CropPestControlSnapshot {
    return {
      cropId: this._cropId, pestId: this._pestId, susceptibility: this._susceptibility,
      sensitiveStages: [...this._sensitiveStages], threshold: this._threshold,
      controlMethods: this._controlMethods.map((m) => m.toJSON()),
      provenance: this._provenance?.toJSON(),
    };
  }

  static fromSnapshot(s: CropPestControlSnapshot): CropPestControl {
    return new CropPestControl(
      s.cropId, s.pestId, s.susceptibility, [...s.sensitiveStages], s.threshold,
      s.controlMethods.map((j) => ControlMethod.fromJSON(j)),
      s.provenance ? Provenance.fromJSON(s.provenance) : undefined,
    );
  }
}
