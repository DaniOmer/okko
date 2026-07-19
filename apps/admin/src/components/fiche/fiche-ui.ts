export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-[#eaf3ea] text-[#245c27]',
  warn: 'bg-[#fef3e2] text-[#b45309]',
  bad: 'bg-[#fdecec] text-[#b91c1c]',
  neutral: 'bg-[#eef1f4] text-[#475569]',
};

export const TONE_DOT: Record<Tone, string> = {
  good: 'bg-[#2e7d32]',
  warn: 'bg-[#d97706]',
  bad: 'bg-[#b91c1c]',
  neutral: 'bg-[#94a1ab]',
};

type ToneKind = 'suitability' | 'susceptibility' | 'resistance';

export function tone(kind: ToneKind, code: string | undefined): Tone {
  switch (kind) {
    case 'suitability':
      return code === 'SUITABLE' ? 'good' : code === 'MARGINAL' ? 'warn' : code === 'UNSUITABLE' ? 'bad' : 'neutral';
    case 'susceptibility':
      return code === 'LOW' ? 'good' : code === 'MEDIUM' ? 'warn' : code === 'HIGH' ? 'bad' : 'neutral';
    case 'resistance':
      return code === 'HIGH' ? 'good' : code === 'MEDIUM' ? 'warn' : code === 'LOW' ? 'bad' : 'neutral';
    default:
      return 'neutral';
  }
}

/** Position 0..100 de l'optimal dans [min,max], clampée ; plage nulle → 50. */
export function optimalPercent(min: number, optimal: number, max: number): number {
  if (max <= min) return 50;
  return Math.min(100, Math.max(0, ((optimal - min) / (max - min)) * 100));
}
