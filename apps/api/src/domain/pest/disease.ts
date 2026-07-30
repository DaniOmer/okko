export interface DiseaseSnapshot {
  firstSymptoms?: Record<string, string>;
  advancedSymptoms?: Record<string, string>;
  confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>;
  propagationModes?: string[];
  potentialLosses?: Record<string, string>;
  evolutionSpeed?: string;
  cropRotation?: Record<string, string>;
  resistantVarieties?: Record<string, string>;
  prophylaxis?: Record<string, string>;
  irrigationControl?: Record<string, string>;
  disinfection?: Record<string, string>;
  culturalControl?: Record<string, string>;
  chemicalControl?: Record<string, string>;
  curativeTreatment?: Record<string, string>;
}
