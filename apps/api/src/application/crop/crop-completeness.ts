export interface CompletenessReport {
  categories: Record<string, boolean>;
  filled: number;
  total: number;
  percent: number;
}

export interface CompletenessInput {
  climatic: boolean;
  edaphic: boolean;
  phenology: boolean;
  nutrition: boolean;
  yields: boolean;
  varieties: boolean;
  zones: boolean;
  windows: boolean;
  pests: boolean;
  prices: boolean;
  commercialization: boolean;
}

export function computeCompleteness(input: CompletenessInput): CompletenessReport {
  const categories: Record<string, boolean> = { ...input };
  const values = Object.values(categories);
  const total = values.length;
  const filled = values.filter(Boolean).length;
  const percent = Math.round((filled / total) * 100);
  return { categories, filled, total, percent };
}
