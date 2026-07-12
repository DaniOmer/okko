import { CycleType } from './cycle-type';
import { ClimaticRequirementsJSON } from '../shared/climatic-requirements';
import { EdaphicRequirementsJSON } from '../shared/edaphic-requirements';
import { PhenologicalStageJSON } from './phenological-stage';
import { NutrientRequirementJSON } from './nutrient-requirement';
import { YieldReferenceJSON } from './yield-reference';
import { VarietySnapshot } from './variety';
import { CroppingWindowSnapshot } from '../window/cropping-window';
import { CropZoneSuitabilitySnapshot } from '../zone/crop-zone-suitability';
import { CropPestControlSnapshot } from '../pest/crop-pest-control';
import { PricePointSnapshot } from '../price/price-point';

export type CropEvent =
  | { type: 'CropCreated'; commonNames: Record<string, string>; scientificName: string; family: string; cycleType: CycleType }
  | { type: 'Renamed'; commonNames: Record<string, string> }
  | { type: 'IdentityEdited'; scientificName: string; family: string; cycleType: CycleType }
  | { type: 'MetadataSet'; key: string; value: unknown }
  | { type: 'ClimaticRequirementsSet'; climatic: ClimaticRequirementsJSON }
  | { type: 'EdaphicRequirementsSet'; edaphic: EdaphicRequirementsJSON }
  | { type: 'PhenologySet'; phenology: PhenologicalStageJSON[] }
  | { type: 'NutritionSet'; nutrition: NutrientRequirementJSON[] }
  | { type: 'YieldsSet'; yields: YieldReferenceJSON[] }
  | { type: 'Published' }
  | { type: 'Archived' }
  | { type: 'VarietyAdded'; variety: VarietySnapshot }
  | { type: 'VarietyUpdated'; variety: VarietySnapshot }
  | { type: 'CroppingWindowAdded'; window: CroppingWindowSnapshot }
  | { type: 'CroppingWindowUpdated'; window: CroppingWindowSnapshot }
  | { type: 'ZoneSuitabilitySet'; suitability: CropZoneSuitabilitySnapshot }
  | { type: 'PestControlSet'; control: CropPestControlSnapshot }
  | { type: 'PricePointAdded'; price: PricePointSnapshot }
  | { type: 'PricePointUpdated'; price: PricePointSnapshot }
  | { type: 'DraftDiscarded' }
  | { type: 'DraftRestored'; revision: number };
