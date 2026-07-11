import Link from 'next/link';
import { getCropVersions, getCropDiff } from '../../../../lib/api';
import { VersionSelectors } from './VersionSelectors';
import { CropDiffView } from './CropDiffView';

export default async function CropDiffPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { from?: string; to?: string } }) {
  const versions = await getCropVersions(params.id).catch(() => []);
  const back = (
    <Link href={`/crops/${params.id}/versions`} className="text-sm text-primary hover:underline">← Retour aux versions</Link>
  );

  if (versions.length < 2) {
    return (
      <main className="p-8 max-w-4xl space-y-4">
        {back}
        <h1 className="text-2xl font-bold">Comparer les versions</h1>
        <p className="text-sm text-muted-foreground">Il faut au moins deux versions publiées pour comparer.</p>
      </main>
    );
  }

  const to = searchParams.to ? Number(searchParams.to) : versions[0].revision;
  const from = searchParams.from ? Number(searchParams.from) : versions[1].revision;
  const diff = await getCropDiff(params.id, from, to).catch(() => null);

  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-2">
        {back}
        <h1 className="text-2xl font-bold">Comparer les versions</h1>
      </div>
      <VersionSelectors cropId={params.id} versions={versions} from={from} to={to} />
      {diff
        ? <CropDiffView diff={diff} />
        : <p className="text-sm text-destructive">Impossible de comparer ces révisions.</p>}
    </main>
  );
}
