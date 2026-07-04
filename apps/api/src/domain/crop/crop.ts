import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CropStatus, assertCanTransition } from './crop-status';
import { ClimaticRequirements, ClimaticRequirementsJSON } from '../shared/climatic-requirements';
import { EdaphicRequirements, EdaphicRequirementsJSON } from '../shared/edaphic-requirements';
import { PhenologicalStage, PhenologicalStageJSON } from './phenological-stage';

export interface CropSnapshot {
  id: string;
  commonNames: Record<string, string>;
  scientificName: string;
  family: string;
  cycleType: CycleType;
  status: CropStatus;
  version: number;
  metadata: Record<string, unknown>;
  climatic?: ClimaticRequirementsJSON;
  edaphic?: EdaphicRequirementsJSON;
  phenology?: PhenologicalStageJSON[];
}

interface CreateCropProps {
  id: string;
  commonNames: TranslatableText;
  scientificName: string;
  family: string;
  cycleType: CycleType;
}

export class Crop {
  private constructor(
    private readonly _id: string,
    private _commonNames: TranslatableText,
    private readonly _scientificName: string,
    private readonly _family: string,
    private readonly _cycleType: CycleType,
    private _status: CropStatus,
    private _version: number,
    private _metadata: Record<string, unknown>,
    private _climatic: ClimaticRequirements | undefined,
    private _edaphic: EdaphicRequirements | undefined,
    private _phenology: PhenologicalStage[],
  ) {}

  static create(props: CreateCropProps): Crop {
    return new Crop(
      props.id, props.commonNames, props.scientificName, props.family,
      props.cycleType, CropStatus.DRAFT, 1, {}, undefined, undefined, [],
    );
  }

  get id(): string { return this._id; }
  get commonNames(): TranslatableText { return this._commonNames; }
  get scientificName(): string { return this._scientificName; }
  get family(): string { return this._family; }
  get cycleType(): CycleType { return this._cycleType; }
  get status(): CropStatus { return this._status; }
  get version(): number { return this._version; }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }
  get climatic(): ClimaticRequirements | undefined { return this._climatic; }
  get edaphic(): EdaphicRequirements | undefined { return this._edaphic; }
  get phenology(): PhenologicalStage[] { return [...this._phenology]; }

  setPhenology(stages: PhenologicalStage[]): void {
    this._phenology = [...stages];
    this._version += 1;
  }

  setClimaticRequirements(c: ClimaticRequirements): void {
    this._climatic = c;
    this._version += 1;
  }

  setEdaphicRequirements(e: EdaphicRequirements): void {
    this._edaphic = e;
    this._version += 1;
  }

  rename(commonNames: TranslatableText): void {
    this._commonNames = commonNames;
    this._version += 1;
  }

  setMetadata(key: string, value: unknown): void {
    this._metadata = { ...this._metadata, [key]: value };
    this._version += 1;
  }

  publish(): void {
    assertCanTransition(this._status, CropStatus.PUBLISHED);
    this._status = CropStatus.PUBLISHED;
  }

  archive(): void {
    assertCanTransition(this._status, CropStatus.ARCHIVED);
    this._status = CropStatus.ARCHIVED;
  }

  toSnapshot(): CropSnapshot {
    return {
      id: this._id,
      commonNames: this._commonNames.toJSON(),
      scientificName: this._scientificName,
      family: this._family,
      cycleType: this._cycleType,
      status: this._status,
      version: this._version,
      metadata: { ...this._metadata },
      climatic: this._climatic?.toJSON(),
      edaphic: this._edaphic?.toJSON(),
      phenology: this._phenology.map((s) => s.toJSON()),
    };
  }

  static fromSnapshot(s: CropSnapshot): Crop {
    return new Crop(
      s.id, TranslatableText.create(s.commonNames), s.scientificName, s.family,
      s.cycleType, s.status, s.version, { ...s.metadata },
      s.climatic ? ClimaticRequirements.fromJSON(s.climatic) : undefined,
      s.edaphic ? EdaphicRequirements.fromJSON(s.edaphic) : undefined,
      (s.phenology ?? []).map((j) => PhenologicalStage.fromJSON(j)),
    );
  }
}
