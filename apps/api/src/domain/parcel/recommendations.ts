import { OperationType } from '../window/operation-type';

export type RecommendationStatus = 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'UNDATED';

export interface RecommendationItem { type: OperationType; label: string; timingDays: number; dueDate?: string; status: RecommendationStatus; }
export interface SowingAdvisory { withinWindow: boolean; sowingStart?: string; sowingEnd?: string; anchorMonth?: string; }
export interface RecommendationsResult { items: RecommendationItem[]; sowingAdvisory?: SowingAdvisory; }

export interface ComputeRecommendationsInput {
  referenceOperations: { type: OperationType; label: string; timingDays: number }[];
  journalOperations: { type: OperationType; date: string }[];
  anchorDate?: string;
  today: string;
  sowingStart?: string;
  sowingEnd?: string;
  dueSoonWindowDays?: number;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthCodeOf = (iso: string): string => MONTHS[new Date(iso).getUTCMonth()];
const addDays = (iso: string, days: number): string => {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
};
const inMonthRange = (month: string, start: string, end: string): boolean => {
  const m = MONTHS.indexOf(month), s = MONTHS.indexOf(start), e = MONTHS.indexOf(end);
  if (m < 0 || s < 0 || e < 0) return true;
  return s <= e ? m >= s && m <= e : m >= s || m <= e;
};

export function computeRecommendations(input: ComputeRecommendationsInput): RecommendationsResult {
  const dueSoon = input.dueSoonWindowDays ?? 7;
  const today = input.today.slice(0, 10);
  const doneTypes = new Set(input.journalOperations.map((o) => o.type));
  const items: RecommendationItem[] = [...input.referenceOperations]
    .sort((a, b) => a.timingDays - b.timingDays)
    .map((ref) => {
      if (doneTypes.has(ref.type)) return { type: ref.type, label: ref.label, timingDays: ref.timingDays, status: 'DONE' };
      if (!input.anchorDate) return { type: ref.type, label: ref.label, timingDays: ref.timingDays, status: 'UNDATED' };
      const dueDate = addDays(input.anchorDate.slice(0, 10), ref.timingDays);
      const soonLimit = addDays(today, dueSoon);
      const status: RecommendationStatus = dueDate < today ? 'OVERDUE' : dueDate <= soonLimit ? 'DUE_SOON' : 'UPCOMING';
      return { type: ref.type, label: ref.label, timingDays: ref.timingDays, dueDate, status };
    });
  let sowingAdvisory: SowingAdvisory | undefined;
  if (input.anchorDate && input.sowingStart && input.sowingEnd) {
    const anchorMonth = monthCodeOf(input.anchorDate);
    sowingAdvisory = { withinWindow: inMonthRange(anchorMonth, input.sowingStart, input.sowingEnd), sowingStart: input.sowingStart, sowingEnd: input.sowingEnd, anchorMonth };
  }
  return { items, sowingAdvisory };
}
