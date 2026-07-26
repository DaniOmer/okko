'use client';

import type { Pest } from '../../../lib/api';
import { labelOf, PEST_TYPE_LABELS, PEST_PHOTO_CATEGORY_LABELS, MONTH_LABELS, ATTACKED_ORGAN_LABELS, DAMAGE_TYPE_LABELS, HARMFULNESS_LABELS, PEST_KIND_LABELS, WEED_CATEGORY_LABELS, NUISANCE_TYPE_LABELS, REPRODUCTION_MODE_LABELS, DISSEMINATION_LABELS } from '@/lib/labels';
import { PhotoCarousel } from '@/components/fiche/PhotoCarousel';
import { Images, Dna, Bug, MapPin, ShieldCheck, BookOpen, Sprout } from 'lucide-react';

export function PestFicheView({ pest }: { pest: Pest }) {
  const photos = (pest.images ?? []).map((img) => ({
    ...img,
    caption: [img.category ? labelOf(PEST_PHOTO_CATEGORY_LABELS, img.category) : '', img.caption]
      .filter(Boolean).join(' — ') || undefined,
  }));

  const b = pest;
  const isWeed = pest.kind === 'WEED';
  const categoryLabel = isWeed ? labelOf(WEED_CATEGORY_LABELS, pest.type) : labelOf(PEST_TYPE_LABELS, pest.type);
  const hasWeedTraits = !!((b.reproductionMode?.length) || b.disseminationCapacity || b.emergenceDepth || b.seedBankLongevity);
  const monthOrder = Object.keys(MONTH_LABELS);
  const range = (r?: { min: number; max: number; unit?: string }) => (r ? `${r.min}–${r.max}${r.unit ? ' ' + r.unit : ''}` : null);
  const hasBiology = !!(b.lifeCycle?.fr || b.cycleDurationDays || (b.developmentStages?.length) || b.generationsPerYear || (b.activityPeriods?.length) ||
    b.favorableConditions?.temperature || b.favorableConditions?.humidity || b.favorableConditions?.rainfall || b.favorableConditions?.notes?.fr || (isWeed && hasWeedTraits));
  const hasDamage = !!((b.attackedOrgans?.length) || (b.damageTypes?.length) || b.harmfulnessLevel || b.symptoms?.fr || (b.nuisanceTypes?.length));
  const hasDistribution = !!((b.geographicAreas?.length) || b.favorableClimate?.fr || b.knownPresence?.fr);
  const hasManagement = !!(b.prevention?.fr || b.biologicalControl?.fr || (b.predators?.length) || (b.parasitoids?.length) || (b.approvedProducts?.length) || b.knownResistances?.fr);
  const hasSources = (b.sources?.length ?? 0) > 0;
  const frDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : null);

  return (
    <div>
      {/* Hero */}
      <div className="flex gap-5 rounded-xl px-6 py-7" style={{ background: 'linear-gradient(135deg,#fdf0f0,#fbfdfb)' }}>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{pest.name}</h1>
          {pest.scientificName && <p className="mt-0.5 text-sm italic text-muted-foreground">{pest.scientificName}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-block rounded-full bg-[#eef3f7] px-3 py-1 text-[13px] font-semibold text-[#2c5a8a]">
              {labelOf(PEST_KIND_LABELS, pest.kind ?? 'ANIMAL')}
            </span>
            <span className="inline-block rounded-full bg-[#f4e6e6] px-3 py-1 text-[13px] font-semibold text-[#8a2c2c]">
              {isWeed ? '🌿' : '🐛'} {categoryLabel}
            </span>
            {pest.family && (
              <span className="inline-block rounded-full bg-[#eee] px-3 py-1 text-[13px] text-[#475569]">
                Famille : {pest.family}
              </span>
            )}
          </div>
          {pest.description?.fr && (
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[#374151]">{pest.description.fr}</p>
          )}
        </div>
        {photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0].url} alt={photos[0].caption ?? pest.name} className="h-28 w-28 shrink-0 rounded-2xl border border-[#e8dddd] object-cover" />
        )}
      </div>

      {/* Sections — carrousel photos en premier, puis les infos */}
      <div className="px-6">
        {photos.length > 0 && (
          <section id="photos" className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#f4e6e6] text-[#8a2c2c]"><Images className="h-4 w-4" /></span>
              Photos
              <span className="font-normal text-muted-foreground">({photos.length})</span>
            </h2>
            <PhotoCarousel images={photos} />
          </section>
        )}

        {hasBiology && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eef3f7] text-[#2c5a8a]"><Dna className="h-4 w-4" /></span>
              Biologie
            </h2>
            <div className="space-y-2 text-sm">
              {b.lifeCycle?.fr && <p><span className="text-muted-foreground">Cycle de vie : </span>{b.lifeCycle.fr}</p>}
              {range(b.cycleDurationDays) && <p><span className="text-muted-foreground">Durée du cycle : </span>{range(b.cycleDurationDays)}</p>}
              {!isWeed && range(b.generationsPerYear) && <p><span className="text-muted-foreground">Générations/an : </span>{range(b.generationsPerYear)}</p>}
              {(b.developmentStages?.length ?? 0) > 0 && (
                <div>
                  <span className="text-muted-foreground">Stades : </span>
                  {b.developmentStages!.map((s, i) => (
                    <span key={i}>{i > 0 ? ' → ' : ''}{s.name.fr}{range(s.durationDays) ? ` (${range(s.durationDays)})` : ''}</span>
                  ))}
                </div>
              )}
              {(b.activityPeriods?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Activité : </span>
                  {monthOrder.filter((m) => b.activityPeriods!.includes(m)).map((m) => (
                    <span key={m} className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-xs text-[#2c5a8a]">{MONTH_LABELS[m].slice(0, 4)}</span>
                  ))}
                </div>
              )}
              {(range(b.favorableConditions?.temperature) || range(b.favorableConditions?.humidity) || range(b.favorableConditions?.rainfall) || b.favorableConditions?.notes?.fr) && (
                <div>
                  <span className="text-muted-foreground">Conditions favorables : </span>
                  {[range(b.favorableConditions?.temperature) && `T° ${range(b.favorableConditions?.temperature)}`,
                    range(b.favorableConditions?.humidity) && `Humidité ${range(b.favorableConditions?.humidity)}`,
                    range(b.favorableConditions?.rainfall) && `Pluie ${range(b.favorableConditions?.rainfall)}`].filter(Boolean).join(' · ')}
                  {b.favorableConditions?.notes?.fr && <span className="text-muted-foreground"> — {b.favorableConditions.notes.fr}</span>}
                </div>
              )}
              {isWeed && (b.reproductionMode?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Reproduction : </span>
                  {b.reproductionMode!.map((r) => <span key={r} className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-xs text-[#2c5a8a]">{labelOf(REPRODUCTION_MODE_LABELS, r)}</span>)}
                </div>
              )}
              {isWeed && b.disseminationCapacity && <p><span className="text-muted-foreground">Dissémination : </span>{labelOf(DISSEMINATION_LABELS, b.disseminationCapacity)}</p>}
              {isWeed && range(b.emergenceDepth) && <p><span className="text-muted-foreground">Profondeur de levée : </span>{range(b.emergenceDepth)}</p>}
              {isWeed && range(b.seedBankLongevity) && <p><span className="text-muted-foreground">Banque de graines : </span>{range(b.seedBankLongevity)}</p>}
            </div>
          </section>
        )}

        {hasDamage && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#f6efe6] text-[#8a5a2c]">{isWeed ? <Sprout className="h-4 w-4" /> : <Bug className="h-4 w-4" />}</span>
              {isWeed ? 'Nuisibilité' : 'Dégâts'}
              {b.harmfulnessLevel && (
                <span className="ml-1 rounded-full bg-[#f6efe6] px-2 py-0.5 text-xs font-medium text-[#8a5a2c]">
                  {labelOf(HARMFULNESS_LABELS, b.harmfulnessLevel)}
                </span>
              )}
            </h2>
            <div className="space-y-2 text-sm">
              {!isWeed && (b.attackedOrgans?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Organes attaqués : </span>
                  {b.attackedOrgans!.map((o) => <span key={o} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{labelOf(ATTACKED_ORGAN_LABELS, o)}</span>)}
                </div>
              )}
              {!isWeed && (b.damageTypes?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Types de dégâts : </span>
                  {b.damageTypes!.map((t) => <span key={t} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{labelOf(DAMAGE_TYPE_LABELS, t)}</span>)}
                </div>
              )}
              {isWeed && (b.nuisanceTypes?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Nuisibilité : </span>
                  {b.nuisanceTypes!.map((n) => <span key={n} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{labelOf(NUISANCE_TYPE_LABELS, n)}</span>)}
                </div>
              )}
              {b.symptoms?.fr && <p><span className="text-muted-foreground">{isWeed ? 'Effets observés' : 'Symptômes'} : </span>{b.symptoms.fr}</p>}
            </div>
          </section>
        )}

        {hasDistribution && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]"><MapPin className="h-4 w-4" /></span>
              Répartition
            </h2>
            <div className="space-y-2 text-sm">
              {(b.geographicAreas?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Zones : </span>
                  {b.geographicAreas!.map((a) => <span key={a} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{a}</span>)}
                </div>
              )}
              {b.favorableClimate?.fr && <p><span className="text-muted-foreground">Climat favorable : </span>{b.favorableClimate.fr}</p>}
              {b.knownPresence?.fr && <p><span className="text-muted-foreground">Présence connue : </span>{b.knownPresence.fr}</p>}
            </div>
          </section>
        )}

        {hasManagement && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]"><ShieldCheck className="h-4 w-4" /></span>
              Gestion
            </h2>
            <div className="space-y-2 text-sm">
              {b.prevention?.fr && <p><span className="text-muted-foreground">Prévention : </span>{b.prevention.fr}</p>}
              {b.biologicalControl?.fr && <p><span className="text-muted-foreground">Lutte biologique : </span>{b.biologicalControl.fr}</p>}
              {!isWeed && (b.predators?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Prédateurs : </span>
                  {b.predators!.map((x) => <span key={x} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{x}</span>)}
                </div>
              )}
              {!isWeed && (b.parasitoids?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Parasitoïdes : </span>
                  {b.parasitoids!.map((x) => <span key={x} className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs">{x}</span>)}
                </div>
              )}
              {(b.approvedProducts?.length ?? 0) > 0 && (
                <div>
                  <span className="text-muted-foreground">Produits homologués : </span>
                  {b.approvedProducts!.map((p, i) => (
                    <span key={i}>{i > 0 ? ' · ' : ''}{p.name}{p.country ? ` (${p.country})` : ''}</span>
                  ))}
                </div>
              )}
              {b.knownResistances?.fr && <p><span className="text-muted-foreground">Résistances : </span>{b.knownResistances.fr}</p>}
            </div>
          </section>
        )}

        {hasSources && (
          <section className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#eaf3ea] text-[#245c27]"><BookOpen className="h-4 w-4" /></span>
              Sources
            </h2>
            <ul className="space-y-1 text-sm">
              {b.sources!.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.title}</a>
                  ) : (
                    <span>{s.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
      {(frDate(pest.createdAt) || frDate(pest.updatedAt)) && (
        <div className="px-6 pb-6 pt-2 text-xs text-muted-foreground">
          {frDate(pest.createdAt) && <>Créé le {frDate(pest.createdAt)}</>}
          {frDate(pest.createdAt) && frDate(pest.updatedAt) && ' · '}
          {frDate(pest.updatedAt) && <>Mis à jour le {frDate(pest.updatedAt)}</>}
        </div>
      )}
    </div>
  );
}
