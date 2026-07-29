export interface DiseaseSnapshot {
  firstSymptoms?: Record<string, string>;
  advancedSymptoms?: Record<string, string>;
  confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>;
  propagationModes?: string[];
  potentialLosses?: Record<string, string>;
  evolutionSpeed?: string;
}
