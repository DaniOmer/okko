import { CropDocument } from './crop-read-model';

export interface FieldChange { field: string; before: unknown; after: unknown; }
export interface ItemChange { key: string; before: unknown; after: unknown; }
export interface SectionDiff { section: string; added: unknown[]; removed: unknown[]; changed: ItemChange[]; }
export interface CropDiff {
  cropId: string;
  from: number;
  to: number;
  fields: FieldChange[];
  sections: SectionDiff[];
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  if (ak.length !== Object.keys(bo).length) return false;
  return ak.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]));
}

// Champs cœur + sections-valeur : tout devient un FieldChange (avant/après entier).
const VALUE_FIELDS = ['name', 'scientificName', 'family', 'cycleType', 'climatic', 'edaphic', 'metadata', 'phenology', 'nutrition', 'yields'] as const;
// Sections à clé : added/removed/changed par clé.
const KEYED_SECTIONS: { section: string; key: string }[] = [
  { section: 'varieties', key: 'id' },
  { section: 'zones', key: 'zoneId' },
  { section: 'croppingWindows', key: 'id' },
  { section: 'pests', key: 'pestId' },
  { section: 'prices', key: 'id' },
];

export function diffCropDocuments(
  fromRevision: number,
  toRevision: number,
  before: CropDocument,
  after: CropDocument,
): CropDiff {
  const b = before as unknown as Record<string, unknown>;
  const a = after as unknown as Record<string, unknown>;

  const fields: FieldChange[] = [];
  for (const f of VALUE_FIELDS) {
    if (!deepEqual(b[f], a[f])) fields.push({ field: f, before: b[f], after: a[f] });
  }

  const sections: SectionDiff[] = [];
  for (const { section, key } of KEYED_SECTIONS) {
    const beforeItems = (b[section] as Record<string, unknown>[] | undefined) ?? [];
    const afterItems = (a[section] as Record<string, unknown>[] | undefined) ?? [];
    const beforeByKey = new Map(beforeItems.map((it) => [String(it[key]), it]));
    const afterByKey = new Map(afterItems.map((it) => [String(it[key]), it]));

    const added: unknown[] = [];
    const removed: unknown[] = [];
    const changed: ItemChange[] = [];

    for (const [k, item] of afterByKey) if (!beforeByKey.has(k)) added.push(item);
    for (const [k, item] of beforeByKey) if (!afterByKey.has(k)) removed.push(item);
    for (const [k, beforeItem] of beforeByKey) {
      const afterItem = afterByKey.get(k);
      if (afterItem !== undefined && !deepEqual(beforeItem, afterItem)) changed.push({ key: k, before: beforeItem, after: afterItem });
    }

    if (added.length || removed.length || changed.length) sections.push({ section, added, removed, changed });
  }

  return { cropId: before.id, from: fromRevision, to: toRevision, fields, sections };
}
