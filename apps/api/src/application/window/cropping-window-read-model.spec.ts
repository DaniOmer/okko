import { toCroppingWindowDocument } from './cropping-window-read-model';
import { OperationType } from '../../domain/window/operation-type';

const w = {
  id: 'w1', cropId: 'c1', zoneId: 'z1', season: 'Saison sèche',
  sowingStart: 'novembre', sowingEnd: 'février', irrigationRequired: true,
  operations: [{ type: OperationType.PLANTING, label: { fr: 'Semis' }, timingDays: 0, inputs: [] }],
};

describe('toCroppingWindowDocument', () => {
  it('serializes season and operations', () => {
    const doc = toCroppingWindowDocument(w, 'fr');
    expect(doc.season).toBe('Saison sèche');
    expect(doc.serializedText).toContain('Saison sèche');
    expect(doc.serializedText).toContain('Semis');
  });
});
