import { ConfirmForm } from './ConfirmForm';

export default function ConfirmPage({ params }: { params: { token: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <div className="text-2xl font-extrabold text-primary">🌱 Okko</div>
      <ConfirmForm token={params.token} />
    </main>
  );
}
