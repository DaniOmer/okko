export const CLOCK = Symbol('CLOCK');

export interface Clock {
  nowIso(): string;
}
