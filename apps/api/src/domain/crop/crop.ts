import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CropStatus, assertCanTransition } from './crop-status';
import { ClimaticRequirements, ClimaticRequirementsJSON } from '../shared/climatic-requirements';
import { EdaphicRequirements, EdaphicRequirementsJSON } from '../shared/edaphic-requirements';
import { PhenologicalStage, PhenologicalStageJSON } from './phenological-stage';
import { NutrientRequirement, NutrientRequirementJSON } from './nutrient-requirement';
import { YieldReference, YieldReferenceJSON } from './yield-reference';
import { CropEvent } from './crop-event';

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
  nutrition?: NutrientRequirementJSON[];
  yields?: YieldReferenceJSON[];
}

interface CreateCropProps {
  id: string;
  commonNames: TranslatableText;
  scientificName: string;
  family: string;
  cycleType: CycleType;
}

export class Crop {
  private _pending: CropEvent[] = [];

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
    private _nutrition: NutrientRequirement[],
    private _yields: YieldReference[],
  ) {}

  static create(props: CreateCropProps): Crop {
    const crop = new Crop(
      props.id, props.commonNames, props.scientificName, props.family,
      props.cycleType, CropStatus.DRAFT, 1, {}, undefined, undefined, [], [], [],
    );
    crop._pending.push({ type: 'CropCreated', commonNames: props.commonNames.toJSON(), scientificName: props.scientificName, family: props.family, cycleType: props.cycleType });
    return crop;
  }

  static fromEvents(stored: { event: CropEvent; streamId: string }[]): Crop {
    if (stored.length === 0 || stored[0].event.type !== 'CropCreated') {
      throw new Error('Crop stream must start with CropCreated');
    }
    const c = stored[0].event; // type CropCreated
    const crop = new Crop(
      stored[0].streamId,
      TranslatableText.create(c.commonNames), c.scientificName, c.family, c.cycleType,
      CropStatus.DRAFT, 1, {}, undefined, undefined, [], [], [],
    );
    for (let i = 1; i < stored.length; i++) crop.apply(stored[i].event);
    return crop;
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
  get nutrition(): NutrientRequirement[] { return [...this._nutrition]; }
  get yields(): YieldReference[] { return [...this._yields]; }

  setPhenology(stages: PhenologicalStage[]): void { this.raise({ type: 'PhenologySet', phenology: stages.map((s) => s.toJSON()) }); }
  setClimaticRequirements(c: ClimaticRequirements): void { this.raise({ type: 'ClimaticRequirementsSet', climatic: c.toJSON() }); }
  setEdaphicRequirements(e: EdaphicRequirements): void { this.raise({ type: 'EdaphicRequirementsSet', edaphic: e.toJSON() }); }
  setNutrition(list: NutrientRequirement[]): void { this.raise({ type: 'NutritionSet', nutrition: list.map((n) => n.toJSON()) }); }
  setYields(list: YieldReference[]): void { this.raise({ type: 'YieldsSet', yields: list.map((y) => y.toJSON()) }); }
  rename(commonNames: TranslatableText): void { this.raise({ type: 'Renamed', commonNames: commonNames.toJSON() }); }
  setMetadata(key: string, value: unknown): void { this.raise({ type: 'MetadataSet', key, value }); }
  publish(): void { assertCanTransition(this._status, CropStatus.PUBLISHED); this.raise({ type: 'Published' }); }
  archive(): void { assertCanTransition(this._status, CropStatus.ARCHIVED); this.raise({ type: 'Archived' }); }

  private raise(e: CropEvent): void { this.apply(e); this._pending.push(e); }
  pullPendingEvents(): CropEvent[] { const p = this._pending; this._pending = []; return p; }

  private apply(e: CropEvent): void {
    switch (e.type) {
      case 'ClimaticRequirementsSet': this._climatic = ClimaticRequirements.fromJSON(e.climatic); this._version += 1; break;
      case 'EdaphicRequirementsSet': this._edaphic = EdaphicRequirements.fromJSON(e.edaphic); this._version += 1; break;
      case 'PhenologySet': this._phenology = e.phenology.map((j) => PhenologicalStage.fromJSON(j)); this._version += 1; break;
      case 'NutritionSet': this._nutrition = e.nutrition.map((j) => NutrientRequirement.fromJSON(j)); this._version += 1; break;
      case 'YieldsSet': this._yields = e.yields.map((j) => YieldReference.fromJSON(j)); this._version += 1; break;
      case 'Renamed': this._commonNames = TranslatableText.create(e.commonNames); this._version += 1; break;
      case 'MetadataSet': this._metadata = { ...this._metadata, [e.key]: e.value }; this._version += 1; break;
      case 'Published': this._status = CropStatus.PUBLISHED; break;
      case 'Archived': this._status = CropStatus.ARCHIVED; break;
      case 'CropCreated': /* posé au constructeur, jamais rejoué ici */ break;
    }
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
      nutrition: this._nutrition.map((n) => n.toJSON()),
      yields: this._yields.map((y) => y.toJSON()),
    };
  }

  static fromSnapshot(s: CropSnapshot): Crop {
    return new Crop(
      s.id, TranslatableText.create(s.commonNames), s.scientificName, s.family,
      s.cycleType, s.status, s.version, { ...s.metadata },
      s.climatic ? ClimaticRequirements.fromJSON(s.climatic) : undefined,
      s.edaphic ? EdaphicRequirements.fromJSON(s.edaphic) : undefined,
      (s.phenology ?? []).map((j) => PhenologicalStage.fromJSON(j)),
      (s.nutrition ?? []).map((j) => NutrientRequirement.fromJSON(j)),
      (s.yields ?? []).map((j) => YieldReference.fromJSON(j)),
    );
  }
}
