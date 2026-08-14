import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listCampaigns, listOperations, getCampaignRecommendations, CampaignRecommendations, listParcels, getCampaignStageAdvice } from '@/lib/api';
import { getSession } from '@/lib/session';
import { labelOf, OPERATION_TYPE_LABELS, RECO_STATUS_LABELS, MONTH_LABELS } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { OperationEditor } from './OperationEditor.client';
import { OperationRowActions } from './OperationRowActions';
import { SendReminderButton } from './SendReminderButton.client';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

export default async function JournalPage({ params }: { params: { id: string; cid: string } }) {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const [campaigns, operations, reco, parcels, stageAdvice] = await Promise.all([
    listCampaigns(params.id).catch(() => []), listOperations(params.cid).catch(() => []),
    getCampaignRecommendations(params.cid).catch((): CampaignRecommendations => ({ hasReference: false, items: [] })),
    listParcels().catch(() => []),
    getCampaignStageAdvice(params.cid).catch(() => null),
  ]);
  const campaign = campaigns.find((c) => c.id === params.cid);
  if (!campaign) notFound();
  const parcel = parcels.find((p) => p.id === params.id);
  const parcelGps = { lat: parcel?.gpsLat, lng: parcel?.gpsLng };
  return (
    <main className="space-y-6">
      <div>
        <Link href={`/parcelles/${params.id}`} className="text-xs text-muted-foreground hover:underline">← Retour à la parcelle</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Journal — {campaign.season}</h1>
          {canWrite && (
            <div className="flex items-center gap-2">
              <SendReminderButton campaignId={campaign.id} />
              <OperationEditor campaignId={campaign.id} parcelGps={parcelGps} trigger={<Button>Nouvelle opération</Button>} />
            </div>
          )}
        </div>
      </div>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Recommandations</h2>
        {!reco.hasReference ? (
          <p className="text-sm text-muted-foreground">Reliez un calendrier de référence à la campagne pour activer les recommandations.</p>
        ) : (
          <div className="space-y-2">
            {reco.sowingAdvisory && reco.sowingAdvisory.withinWindow === false && (
              <p className="rounded-md bg-[#fdf0f0] px-3 py-2 text-sm text-[#8a2c2c]">
                ⚠️ Fenêtre de semis recommandée : {labelOf(MONTH_LABELS, reco.sowingAdvisory.sowingStart ?? '')} → {labelOf(MONTH_LABELS, reco.sowingAdvisory.sowingEnd ?? '')} ; vous démarrez en {labelOf(MONTH_LABELS, reco.sowingAdvisory.anchorMonth ?? '')}.
              </p>
            )}
            {reco.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune opération de référence.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {reco.items.map((it, i) => (
                  <li key={`${it.type}-${it.timingDays}`} className="flex items-center justify-between gap-2">
                    <span>{labelOf(OPERATION_TYPE_LABELS, it.type)}{it.dueDate ? ` · ${new Date(it.dueDate).toLocaleDateString('fr-FR')}` : ''}</span>
                    <span className="rounded-full bg-[#eef3f7] px-2 py-0.5 text-xs text-[#2c5a8a]">{labelOf(RECO_STATUS_LABELS, it.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      {stageAdvice && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Conseil du stade — {stageAdvice.stageName}</h2>
          <p className="text-sm">{stageAdvice.advice}</p>
        </section>
      )}
      {operations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune opération journalisée.</p>
      ) : (
        <ol className="relative space-y-4 border-l pl-6">
          {operations.map((op) => (
            <li key={op.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-primary" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{labelOf(OPERATION_TYPE_LABELS, op.type)} <span className="font-normal text-muted-foreground">· {new Date(op.date).toLocaleDateString('fr-FR')}</span></p>
                  {op.inputs.length > 0 && (
                    <p className="text-sm text-muted-foreground">{op.inputs.map((i) => `${i.product}${i.quantity != null ? ` ${i.quantity}${i.unit ?? ''}` : ''}`).join(' · ')}</p>
                  )}
                  {op.laborCost != null && <p className="text-xs text-muted-foreground">Main d&apos;œuvre : {op.laborCost}</p>}
                  {op.notes && <p className="text-sm">{op.notes}</p>}
                  {op.photos.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {op.photos.map((img) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={img.key} src={img.url} alt={img.caption || ''} className="h-16 w-16 rounded object-cover" />
                      ))}
                    </div>
                  )}
                  {op.gpsLat != null && op.gpsLng != null && (
                    <p className="mt-1 text-xs text-muted-foreground"><span aria-hidden="true">📍 </span>{op.gpsLat.toFixed(5)}, {op.gpsLng.toFixed(5)}</p>
                  )}
                </div>
                {canWrite && <OperationRowActions op={op} />}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
