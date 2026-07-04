import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function HistoryPage() {
  return (
    <main className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Historique</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal des modifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            L&apos;historique des modifications est consultable <strong>fiche par fiche</strong> :
            ouvrez une culture depuis <Link href="/crops" className="text-primary hover:underline">Cultures</Link>,
            la section « Historique » liste ses changements.
          </p>
          <p>Un journal global transverse sera ajouté ultérieurement (nécessite un nouvel endpoint API).</p>
        </CardContent>
      </Card>
    </main>
  );
}
