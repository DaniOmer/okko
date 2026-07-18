import { TranslatableText } from '../shared/translatable-text';
import { CycleType } from './cycle-type';
import { CropStatus, assertCanTransition } from './crop-status';
import { ClimaticRequirements, ClimaticRequirementsJSON } from '../shared/climatic-requirements';
import { EdaphicRequirements, EdaphicRequirementsJSON } from '../shared/edaphic-requirements';
import { PhenologicalStage, PhenologicalStageJSON } from './phenological-stage';
import { NutrientRequirement, NutrientRequirementJSON } from './nutrient-requirement';
import { YieldReference, YieldReferenceJSON } from './yield-reference';
import { CommercializationProduct, CommercializationProductJSON } from './commercialization-product';
import { CropEvent } from './crop-event';
import { VarietySnapshot } from './variety';
import { CroppingWindowSnapshot } from '../window/cropping-window';
import { CropZoneSuitabilitySnapshot } from '../zone/crop-zone-suitability';
import { CropPestControlSnapshot } from '../pest/crop-pest-control';
import { PricePointSnapshot } from '../price/price-point';

export class NoPublishedVersionError extends Error {
  constructor(public readonly cropId: string) {
    super(`Crop ${cropId} has no published version to revert to`);
    this.name = 'NoPublishedVersionError';
  }
}

export class RevisionNotFoundError extends Error {
  constructor(public readonly cropId: string, public readonly revision: number) {
    super(`Crop ${cropId} has no published revision ${revision}`);
    this.name = 'RevisionNotFoundError';
  }
}

interface Checkpoint {
  commonNames: TranslatableText;
  status: CropStatus;
  version: number;
  metadata: Record<string, unknown>;
  climatic: ClimaticRequirements | undefined;
  edaphic: EdaphicRequirements | undefined;
  phenology: PhenologicalStage[];
  nutrition: NutrientRequirement[];
  yields: YieldReference[];
  commercialization: CommercializationProduct[];
  varieties: VarietySnapshot[];
  windows: CroppingWindowSnapshot[];
  zones: CropZoneSuitabilitySnapshot[];
  pests: CropPestControlSnapshot[];
  prices: PricePointSnapshot[];
}

export interface CropSnapshot {
  id: string;
  commonNames: Record<string, string>;
  scientificName: string;
  family: string;
  cycleType: CycleType;
  usageCategory?: string;
  description?: Record<string, string>;
  status: CropStatus;
  version: number;
  metadata: Record<string, unknown>;
  climatic?: ClimaticRequirementsJSON;
  edaphic?: EdaphicRequirementsJSON;
  phenology?: PhenologicalStageJSON[];
  nutrition?: NutrientRequirementJSON[];
  yields?: YieldReferenceJSON[];
  commercialization: CommercializationProductJSON[];
  hasUnpublishedChanges: boolean;
  hasPublishedVersion: boolean;
  publishedVersion: number;
}

interface CreateCropProps {
  id: string;
  commonNames: TranslatableText;
  scientificName: string;
  family: string;
  cycleType: CycleType;
  usageCategory?: string;
  description?: Record<string, string>;
}

export class Crop {
  private _pending: CropEvent[] = [];
  private _varieties: VarietySnapshot[] = [];
  private _windows: CroppingWindowSnapshot[] = [];
  private _zones: CropZoneSuitabilitySnapshot[] = [];
  private _pests: CropPestControlSnapshot[] = [];
  private _prices: PricePointSnapshot[] = [];
  private _hasUnpublishedChanges = false;
  private _hasPublishedVersion = false;
  private _publishedRevision = 0;
  private _checkpoints = new Map<number, Checkpoint>();

  private constructor(
    private readonly _id: string,
    private _commonNames: TranslatableText,
    private _scientificName: string,
    private _family: string,
    private _cycleType: CycleType,
    private _status: CropStatus,
    private _version: number,
    private _metadata: Record<string, unknown>,
    private _climatic: ClimaticRequirements | undefined,
    private _edaphic: EdaphicRequirements | undefined,
    private _phenology: PhenologicalStage[],
    private _nutrition: NutrientRequirement[],
    private _yields: YieldReference[],
    private _commercialization: CommercializationProduct[],
    private _usageCategory: string | undefined,
    private _description: Record<string, string> | undefined,
  ) {}

  static create(props: CreateCropProps): Crop {
    const crop = new Crop(
      props.id, props.commonNames, props.scientificName, props.family,
      props.cycleType, CropStatus.DRAFT, 1, {}, undefined, undefined, [], [], [], [],
      props.usageCategory, props.description,
    );
    crop._pending.push({ type: 'CropCreated', commonNames: props.commonNames.toJSON(), scientificName: props.scientificName, family: props.family, cycleType: props.cycleType, usageCategory: props.usageCategory, description: props.description });
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
      CropStatus.DRAFT, 1, {}, undefined, undefined, [], [], [], [],
      c.usageCategory, c.description,
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
  get commercialization(): CommercializationProduct[] { return [...this._commercialization]; }
  get usageCategory(): string | undefined { return this._usageCategory; }
  get description(): Record<string, string> | undefined { return this._description; }
  get varieties(): VarietySnapshot[] { return [...this._varieties]; }
  get windows(): CroppingWindowSnapshot[] { return [...this._windows]; }
  get zones(): CropZoneSuitabilitySnapshot[] { return [...this._zones]; }
  get pests(): CropPestControlSnapshot[] { return [...this._pests]; }
  get prices(): PricePointSnapshot[] { return [...this._prices]; }
  get hasUnpublishedChanges(): boolean { return this._hasUnpublishedChanges; }
  get hasPublishedVersion(): boolean { return this._hasPublishedVersion; }

  setPhenology(stages: PhenologicalStage[]): void { this.raise({ type: 'PhenologySet', phenology: stages.map((s) => s.toJSON()) }); }
  setClimaticRequirements(c: ClimaticRequirements): void { this.raise({ type: 'ClimaticRequirementsSet', climatic: c.toJSON() }); }
  setEdaphicRequirements(e: EdaphicRequirements): void { this.raise({ type: 'EdaphicRequirementsSet', edaphic: e.toJSON() }); }
  setNutrition(list: NutrientRequirement[]): void { this.raise({ type: 'NutritionSet', nutrition: list.map((n) => n.toJSON()) }); }
  setYields(list: YieldReference[]): void { this.raise({ type: 'YieldsSet', yields: list.map((y) => y.toJSON()) }); }
  setCommercialization(list: CommercializationProduct[]): void { this.raise({ type: 'CommercializationSet', commercialization: list.map((p) => p.toJSON()) }); }
  rename(commonNames: TranslatableText): void { this.raise({ type: 'Renamed', commonNames: commonNames.toJSON() }); }
  editIdentity(p: { scientificName: string; family: string; cycleType: CycleType; usageCategory?: string; description?: Record<string, string> }): void { this.raise({ type: 'IdentityEdited', scientificName: p.scientificName, family: p.family, cycleType: p.cycleType, usageCategory: p.usageCategory, description: p.description }); }
  setMetadata(key: string, value: unknown): void { this.raise({ type: 'MetadataSet', key, value }); }
  publish(): void { assertCanTransition(this._status, CropStatus.PUBLISHED); this.raise({ type: 'Published' }); }
  archive(): void { assertCanTransition(this._status, CropStatus.ARCHIVED); this.raise({ type: 'Archived' }); }
  unarchive(): void { assertCanTransition(this._status, CropStatus.DRAFT); this.raise({ type: 'Unarchived' }); }
  discardDraft(): void {
    if (!this._hasPublishedVersion) throw new NoPublishedVersionError(this._id);
    this.raise({ type: 'DraftDiscarded' });
  }
  restoreDraft(revision: number): void {
    if (!this._hasPublishedVersion) throw new NoPublishedVersionError(this._id);
    if (!this._checkpoints.has(revision)) throw new RevisionNotFoundError(this._id, revision);
    this.raise({ type: 'DraftRestored', revision });
  }
  addVariety(v: VarietySnapshot): void { this.raise({ type: 'VarietyAdded', variety: v }); }
  updateVariety(v: VarietySnapshot): void { this.raise({ type: 'VarietyUpdated', variety: v }); }
  addCroppingWindow(w: CroppingWindowSnapshot): void { this.raise({ type: 'CroppingWindowAdded', window: w }); }
  updateCroppingWindow(w: CroppingWindowSnapshot): void { this.raise({ type: 'CroppingWindowUpdated', window: w }); }
  addPricePoint(p: PricePointSnapshot): void { this.raise({ type: 'PricePointAdded', price: p }); }
  updatePricePoint(p: PricePointSnapshot): void { this.raise({ type: 'PricePointUpdated', price: p }); }
  setZoneSuitability(s: CropZoneSuitabilitySnapshot): void { this.raise({ type: 'ZoneSuitabilitySet', suitability: s }); }
  setPestControl(c: CropPestControlSnapshot): void { this.raise({ type: 'PestControlSet', control: c }); }

  private raise(e: CropEvent): void { this.apply(e); this._pending.push(e); }
  pullPendingEvents(): CropEvent[] { const p = this._pending; this._pending = []; return p; }

  private apply(e: CropEvent): void {
    switch (e.type) {
      case 'ClimaticRequirementsSet': this._climatic = ClimaticRequirements.fromJSON(e.climatic); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'EdaphicRequirementsSet': this._edaphic = EdaphicRequirements.fromJSON(e.edaphic); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'PhenologySet': this._phenology = e.phenology.map((j) => PhenologicalStage.fromJSON(j)); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'NutritionSet': this._nutrition = e.nutrition.map((j) => NutrientRequirement.fromJSON(j)); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'YieldsSet': this._yields = e.yields.map((j) => YieldReference.fromJSON(j)); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'CommercializationSet': this._commercialization = e.commercialization.map((j) => CommercializationProduct.fromJSON(j)); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'Renamed': this._commonNames = TranslatableText.create(e.commonNames); this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'IdentityEdited': this._scientificName = e.scientificName; this._family = e.family; this._cycleType = e.cycleType; this._usageCategory = e.usageCategory; this._description = e.description; this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'MetadataSet': this._metadata = { ...this._metadata, [e.key]: e.value }; this._version += 1; this._hasUnpublishedChanges = true; break;
      case 'Published': this._status = CropStatus.PUBLISHED; this._hasPublishedVersion = true; this._hasUnpublishedChanges = false; this._publishedRevision += 1; this.captureCheckpoint(); break;
      case 'DraftDiscarded': this.restoreFromCheckpoint(this._publishedRevision); break;
      case 'DraftRestored': this.restoreFromCheckpoint(e.revision); break;
      case 'Archived': this._status = CropStatus.ARCHIVED; break;
      case 'Unarchived': this._status = CropStatus.DRAFT; break;
      case 'CropCreated': /* posé au constructeur, jamais rejoué ici */ break;
      case 'VarietyAdded': this._varieties = [...this._varieties, e.variety]; this._hasUnpublishedChanges = true; break;
      case 'VarietyUpdated': this._varieties = this._varieties.map((x) => (x.id === e.variety.id ? e.variety : x)); this._hasUnpublishedChanges = true; break;
      case 'CroppingWindowAdded': this._windows = [...this._windows, e.window]; this._hasUnpublishedChanges = true; break;
      case 'CroppingWindowUpdated': this._windows = this._windows.map((x) => (x.id === e.window.id ? e.window : x)); this._hasUnpublishedChanges = true; break;
      case 'PricePointAdded': this._prices = [...this._prices, e.price]; this._hasUnpublishedChanges = true; break;
      case 'PricePointUpdated': this._prices = this._prices.map((x) => x.id === e.price.id ? e.price : x); this._hasUnpublishedChanges = true; break;
      case 'ZoneSuitabilitySet': this._zones = [...this._zones.filter((z) => z.zoneId !== e.suitability.zoneId), e.suitability]; this._hasUnpublishedChanges = true; break;
      case 'PestControlSet': this._pests = [...this._pests.filter((p) => p.pestId !== e.control.pestId), e.control]; this._hasUnpublishedChanges = true; break;
    }
  }

  private captureCheckpoint(): void {
    this._checkpoints.set(this._publishedRevision, {
      commonNames: this._commonNames, status: this._status, version: this._version,
      metadata: { ...this._metadata }, climatic: this._climatic, edaphic: this._edaphic,
      phenology: [...this._phenology], nutrition: [...this._nutrition], yields: [...this._yields],
      commercialization: [...this._commercialization],
      varieties: [...this._varieties], windows: [...this._windows], zones: [...this._zones],
      pests: [...this._pests], prices: [...this._prices],
    });
  }

  private restoreFromCheckpoint(revision: number): void {
    const cp = this._checkpoints.get(revision)!;
    this._commonNames = cp.commonNames; this._status = cp.status; this._version = cp.version;
    this._metadata = { ...cp.metadata }; this._climatic = cp.climatic; this._edaphic = cp.edaphic;
    this._phenology = [...cp.phenology]; this._nutrition = [...cp.nutrition]; this._yields = [...cp.yields];
    this._commercialization = [...cp.commercialization];
    this._varieties = [...cp.varieties]; this._windows = [...cp.windows]; this._zones = [...cp.zones];
    this._pests = [...cp.pests]; this._prices = [...cp.prices];
    this._hasUnpublishedChanges = (revision !== this._publishedRevision);
  }

  toSnapshot(): CropSnapshot {
    return {
      id: this._id,
      commonNames: this._commonNames.toJSON(),
      scientificName: this._scientificName,
      family: this._family,
      cycleType: this._cycleType,
      usageCategory: this._usageCategory,
      description: this._description,
      status: this._status,
      version: this._version,
      metadata: { ...this._metadata },
      climatic: this._climatic?.toJSON(),
      edaphic: this._edaphic?.toJSON(),
      phenology: this._phenology.map((s) => s.toJSON()),
      nutrition: this._nutrition.map((n) => n.toJSON()),
      yields: this._yields.map((y) => y.toJSON()),
      commercialization: this._commercialization.map((p) => p.toJSON()),
      hasUnpublishedChanges: this._hasUnpublishedChanges,
      hasPublishedVersion: this._hasPublishedVersion,
      publishedVersion: this._publishedRevision,
    };
  }

  static fromSnapshot(s: CropSnapshot): Crop {
    // GARDE : fromSnapshot ne restaure pas _checkpoints ni _publishedRevision.
    // Ne pas utiliser cette instance comme base pour des mutations (notamment discardDraft/restoreDraft).
    // Tous les chemins de commande reconstruisent via fromEvents.
    const crop = new Crop(
      s.id, TranslatableText.create(s.commonNames), s.scientificName, s.family,
      s.cycleType, s.status, s.version, { ...s.metadata },
      s.climatic ? ClimaticRequirements.fromJSON(s.climatic) : undefined,
      s.edaphic ? EdaphicRequirements.fromJSON(s.edaphic) : undefined,
      (s.phenology ?? []).map((j) => PhenologicalStage.fromJSON(j)),
      (s.nutrition ?? []).map((j) => NutrientRequirement.fromJSON(j)),
      (s.yields ?? []).map((j) => YieldReference.fromJSON(j)),
      (s.commercialization ?? []).map((j) => CommercializationProduct.fromJSON(j)),
      s.usageCategory, s.description,
    );
    crop._hasUnpublishedChanges = s.hasUnpublishedChanges;
    crop._hasPublishedVersion = s.hasPublishedVersion;
    return crop;
  }
}
