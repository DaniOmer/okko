import { CycleType } from './cycle-type';
import { ClimaticRequirementsJSON } from '../shared/climatic-requirements';
import { EdaphicRequirementsJSON } from '../shared/edaphic-requirements';
import { PhenologicalStageJSON } from './phenological-stage';
import { NutrientRequirementJSON } from './nutrient-requirement';
import { YieldReferenceJSON } from './yield-reference';

export type CropEvent =
  | { type: 'CropCreated'; commonNames: Record<string, string>; scientificName: string; family: string; cycleType: CycleType }
  | { type: 'Renamed'; commonNames: Record<string, string> }
  | { type: 'MetadataSet'; key: string; value: unknown }
  | { type: 'ClimaticRequirementsSet'; climatic: ClimaticRequirementsJSON }
  | { type: 'EdaphicRequirementsSet'; edaphic: EdaphicRequirementsJSON }
  | { type: 'PhenologySet'; phenology: PhenologicalStageJSON[] }
  | { type: 'NutritionSet'; nutrition: NutrientRequirementJSON[] }
  | { type: 'YieldsSet'; yields: YieldReferenceJSON[] }
  | { type: 'Published' }
  | { type: 'Archived' };
