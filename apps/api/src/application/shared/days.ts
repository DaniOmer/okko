export function daysBetween(aIso: string, bIso: string): number {
  return Math.floor((Date.parse(bIso.slice(0, 10)) - Date.parse(aIso.slice(0, 10))) / 86400000);
}
