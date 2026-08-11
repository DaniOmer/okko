import { computeRecommendations } from './recommendations';
import { OperationType } from '../window/operation-type';

const ref = [
  { type: OperationType.PLANTING, label: 'Semis', timingDays: 0 },
  { type: OperationType.WEEDING, label: 'Sarclage', timingDays: 21 },
  { type: OperationType.HARVEST, label: 'Récolte', timingDays: 110 },
];

describe('computeRecommendations', () => {
  it('DONE si une op du meme type existe au journal', () => {
    const r = computeRecommendations({ referenceOperations: ref, journalOperations: [{ type: OperationType.PLANTING, date: '2026-05-01' }], anchorDate: '2026-05-01', today: '2026-05-10', dueSoonWindowDays: 7 });
    expect(r.items.find((i: any) => i.type === OperationType.PLANTING)?.status).toBe('DONE');
  });
  it('OVERDUE / DUE_SOON / UPCOMING selon echeance vs aujourd hui', () => {
    const r = computeRecommendations({ referenceOperations: ref, journalOperations: [], anchorDate: '2026-05-01', today: '2026-05-25', dueSoonWindowDays: 7 });
    // Semis j0 → 2026-05-01 (passé) = OVERDUE ; Sarclage j21 → 2026-05-22 (passé) = OVERDUE ; Récolte j110 = UPCOMING
    expect(r.items.find((i: any) => i.type === OperationType.PLANTING)?.status).toBe('OVERDUE');
    expect(r.items.find((i: any) => i.type === OperationType.HARVEST)?.status).toBe('UPCOMING');
  });
  it('DUE_SOON si echeance dans la fenetre', () => {
    const r = computeRecommendations({ referenceOperations: [{ type: OperationType.WEEDING, label: 'Sarclage', timingDays: 5 }], journalOperations: [], anchorDate: '2026-05-01', today: '2026-05-03', dueSoonWindowDays: 7 });
    expect(r.items[0].status).toBe('DUE_SOON'); // echeance 2026-05-06, dans [2026-05-03, 2026-05-10]
    expect(r.items[0].dueDate).toBe('2026-05-06');
  });
  it('UNDATED sans ancrage ; tri par timingDays', () => {
    const r = computeRecommendations({ referenceOperations: ref, journalOperations: [], today: '2026-05-10' });
    expect(r.items.map((i: any) => i.timingDays)).toEqual([0, 21, 110]);
    expect(r.items.every((i: any) => i.status === 'UNDATED')).toBe(true);
  });
  it('avertissement fenetre de semis : hors periode', () => {
    const r = computeRecommendations({ referenceOperations: [], journalOperations: [], anchorDate: '2026-01-15', today: '2026-01-20', sowingStart: 'MAY', sowingEnd: 'JUL' });
    expect(r.sowingAdvisory).toEqual({ withinWindow: false, sowingStart: 'MAY', sowingEnd: 'JUL', anchorMonth: 'JAN' });
  });
  it('avertissement fenetre de semis : dans la periode', () => {
    const r = computeRecommendations({ referenceOperations: [], journalOperations: [], anchorDate: '2026-06-15', today: '2026-06-20', sowingStart: 'MAY', sowingEnd: 'JUL' });
    expect(r.sowingAdvisory?.withinWindow).toBe(true);
  });
});
