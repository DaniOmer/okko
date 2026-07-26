import { MinMaxRangeJSON } from '../shared/min-max-range';

export interface WeedSnapshot {
  reproductionMode?: string[];
  disseminationCapacity?: string;
  emergenceDepth?: MinMaxRangeJSON;
  seedBankLongevity?: MinMaxRangeJSON;
}
