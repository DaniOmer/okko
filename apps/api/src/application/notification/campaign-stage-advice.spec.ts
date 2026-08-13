import { currentStage, resolveCampaignStageAdvice } from './campaign-stage-advice';
import { OperationType } from '../../domain/window/operation-type';
import type { PhenologicalStageJSON } from '../../domain/crop/phenological-stage';

const PHENO: PhenologicalStageJSON[] = [
  { name: { fr: 'Levée' }, startDay: 0, endDay: 10, order: 0 },
  { name: { fr: 'Floraison' }, startDay: 50, endDay: 65, order: 1, recommendedWork: 'Surveiller les pucerons.' },
  { name: { fr: 'Maturation' }, startDay: 90, endDay: 120, order: 2, description: 'Préparer la récolte.' },
];

describe('currentStage', () => {
  it('renvoie le stade contenant daysSinceAnchor', () => {
    expect(currentStage(PHENO, 55)?.name.fr).toBe('Floraison');
  });
  it('renvoie null hors de tout stade', () => {
    expect(currentStage(PHENO, 30)).toBeNull();
  });
  it('en cas de chevauchement, plus petit order', () => {
    const overlap: PhenologicalStageJSON[] = [
      { name: { fr: 'B' }, startDay: 0, endDay: 100, order: 2 },
      { name: { fr: 'A' }, startDay: 0, endDay: 100, order: 1 },
    ];
    expect(currentStage(overlap, 10)?.name.fr).toBe('A');
  });
});

describe('resolveCampaignStageAdvice', () => {
  const opsPlanting = [{ type: OperationType.PLANTING, date: '2026-05-01' }];
  it('ancrage semis + recommendedWork prioritaire (J55 → Floraison)', () => {
    const r = resolveCampaignStageAdvice({ startDate: '2026-04-01' }, PHENO, opsPlanting, '2026-06-25T00:00:00.000Z');
    expect(r).toEqual({ stageName: 'Floraison', advice: 'Surveiller les pucerons.' });
  });
  it('repli sur startDate sans op de semis (J55 → Floraison)', () => {
    const r = resolveCampaignStageAdvice({ startDate: '2026-05-01' }, PHENO, [], '2026-06-25T00:00:00.000Z');
    expect(r).toEqual({ stageName: 'Floraison', advice: 'Surveiller les pucerons.' });
  });
  it('description si recommendedWork absent (J92 → Maturation)', () => {
    const r = resolveCampaignStageAdvice({ startDate: '2026-05-01' }, PHENO, [], '2026-08-01T00:00:00.000Z');
    expect(r).toEqual({ stageName: 'Maturation', advice: 'Préparer la récolte.' });
  });
  it('sans ancrage → null', () => {
    expect(resolveCampaignStageAdvice({}, PHENO, [], '2026-06-25T00:00:00.000Z')).toBeNull();
  });
  it('conseil vide (Levée, ni recommendedWork ni description) → null', () => {
    expect(resolveCampaignStageAdvice({ startDate: '2026-05-01' }, PHENO, opsPlanting, '2026-05-03T00:00:00.000Z')).toBeNull();
  });
});
