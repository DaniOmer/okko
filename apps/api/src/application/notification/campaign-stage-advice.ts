import { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { OperationType } from '../../domain/window/operation-type';
import { daysBetween } from '../shared/days';

export function currentStage(phenology: PhenologicalStageJSON[], daysSinceAnchor: number): PhenologicalStageJSON | null {
  const matches = phenology.filter((s) => daysSinceAnchor >= s.startDay && daysSinceAnchor <= s.endDay);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (b.order < a.order ? b : a));
}

export function resolveCampaignStageAdvice(
  campaign: { startDate?: string },
  phenology: PhenologicalStageJSON[],
  journalOps: { type: OperationType; date: string }[],
  today: string,
): { stageName: string; advice: string } | null {
  const sow = journalOps.filter((o) => o.type === OperationType.PLANTING || o.type === OperationType.NURSERY).map((o) => o.date).sort()[0];
  const anchor = sow ?? campaign.startDate;
  if (!anchor) return null;
  const stage = currentStage(phenology, daysBetween(anchor, today));
  if (!stage) return null;
  const advice = stage.recommendedWork ?? stage.description;
  if (!advice) return null;
  const stageName = stage.name.fr ?? Object.values(stage.name)[0] ?? '';
  return { stageName, advice };
}
