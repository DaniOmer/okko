import crops from './fao-crops.json';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export interface FaoCrop { code: string; nameFr: string; nameEn: string; }

export class FaoCropCatalog {
  private readonly all: FaoCrop[] = crops as FaoCrop[];
  search(q: string): FaoCrop[] {
    const n = norm(q.trim());
    const list = n ? this.all.filter((c) => norm(c.nameFr).includes(n) || norm(c.nameEn).includes(n)) : this.all;
    return list.slice(0, 20);
  }
}
