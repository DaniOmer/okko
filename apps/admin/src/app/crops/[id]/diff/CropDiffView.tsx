import { CropDiff, FieldChange, SectionDiff } from '../../../../lib/api';

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom', scientificName: 'Nom scientifique', family: 'Famille', cycleType: 'Type de cycle',
  climatic: 'Exigences climatiques', edaphic: 'Exigences édaphiques', metadata: 'Métadonnées',
  phenology: 'Phénologie', nutrition: 'Nutrition', yields: 'Rendement',
};

const SECTION_LABELS: Record<string, string> = {
  varieties: 'Variétés', zones: 'Zones', croppingWindows: 'Fenêtres de production',
  pests: 'Ravageurs & maladies', prices: 'Prix',
};

function isScalar(v: unknown): boolean {
  return typeof v === 'string' || typeof v === 'number';
}

function itemLabel(section: string, item: unknown): string {
  const it = (item ?? {}) as Record<string, any>;
  switch (section) {
    case 'varieties': return it.name?.fr ?? String(it.id ?? '?');
    case 'zones': return it.zoneName?.fr ?? String(it.zoneId ?? '?');
    case 'pests': return it.pestName?.fr ?? String(it.pestId ?? '?');
    case 'prices': return `${it.market ?? '?'} — ${it.date ?? '?'}`;
    case 'croppingWindows': return it.season ?? String(it.id ?? '?');
    default: return String(it.id ?? '?');
  }
}

function Json({ value }: { value: unknown }) {
  return <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
}

function BeforeAfter({ before, after }: { before: unknown; after: unknown }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <div><div className="text-xs text-muted-foreground">avant</div><Json value={before} /></div>
      <div><div className="text-xs text-muted-foreground">après</div><Json value={after} /></div>
    </div>
  );
}

function FieldRow({ change }: { change: FieldChange }) {
  const label = FIELD_LABELS[change.field] ?? change.field;
  if (isScalar(change.before) && isScalar(change.after)) {
    return <li><strong>{label}</strong> : {String(change.before)} → {String(change.after)}</li>;
  }
  return (
    <li className="space-y-1">
      <strong>{label}</strong>
      <BeforeAfter before={change.before} after={change.after} />
    </li>
  );
}

function SectionBlock({ diff }: { diff: SectionDiff }) {
  const label = SECTION_LABELS[diff.section] ?? diff.section;
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{label}</h3>
      {diff.added.length > 0 && (
        <div>
          <div className="text-sm font-medium text-green-700">Ajoutés</div>
          <ul className="list-disc pl-5 text-sm text-green-700">
            {diff.added.map((it, i) => <li key={`${i}-${itemLabel(diff.section, it)}`}>{itemLabel(diff.section, it)}</li>)}
          </ul>
        </div>
      )}
      {diff.removed.length > 0 && (
        <div>
          <div className="text-sm font-medium text-red-700">Supprimés</div>
          <ul className="list-disc pl-5 text-sm text-red-700">
            {diff.removed.map((it, i) => <li key={`${i}-${itemLabel(diff.section, it)}`}>{itemLabel(diff.section, it)}</li>)}
          </ul>
        </div>
      )}
      {diff.changed.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Modifiés</div>
          {diff.changed.map((c) => (
            <div key={c.key} className="space-y-1">
              <div className="text-sm font-medium">{itemLabel(diff.section, c.before)}</div>
              <BeforeAfter before={c.before} after={c.after} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CropDiffView({ diff }: { diff: CropDiff }) {
  if (diff.fields.length === 0 && diff.sections.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune différence entre ces deux versions.</p>;
  }
  return (
    <div className="space-y-6">
      {diff.fields.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Champs modifiés</h2>
          <ul className="space-y-2 text-sm">
            {diff.fields.map((f, i) => <FieldRow key={i} change={f} />)}
          </ul>
        </div>
      )}
      {diff.sections.map((s) => <SectionBlock key={s.section} diff={s} />)}
    </div>
  );
}
