import { CroppingWindowSnapshot } from '../../domain/window/cropping-window';

export interface CroppingWindowDocument {
  id: string;
  cropId: string;
  zoneId: string;
  season: string;
  sowingStart?: string;
  sowingEnd?: string;
  irrigationRequired: boolean;
  operations: CroppingWindowSnapshot['operations'];
  notes?: string;
  serializedText: string;
}

export function toCroppingWindowDocument(w: CroppingWindowSnapshot, locale = 'fr'): CroppingWindowDocument {
  const lines = [`## Fenêtre : ${w.season}${w.irrigationRequired ? ' (irrigation requise)' : ''}`];
  if (w.sowingStart || w.sowingEnd) lines.push(`Semis : ${w.sowingStart ?? '?'} – ${w.sowingEnd ?? '?'}`);
  for (const op of w.operations) {
    const label = op.label[locale] ?? op.label['fr'];
    lines.push(`- J+${op.timingDays} ${label} (${op.type})`);
  }
  return { ...w, serializedText: lines.join('\n') };
}
