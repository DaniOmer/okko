// Mappage codes d'énumération (API) → libellés FR (affichage). L'ordre des clés
// définit l'ordre des options de select (JS conserve l'ordre d'insertion).

export const USAGE_CATEGORY_LABELS: Record<string, string> = {
  CEREAL: 'Céréale', LEGUME: 'Légumineuse', VEGETABLE: 'Maraîchère', FRUIT: 'Fruitière',
  TUBER: 'Tubercule', INDUSTRIAL: 'Industrielle', FODDER: 'Fourragère', TREE: 'Arboricole',
};

export const CYCLE_TYPE_LABELS: Record<string, string> = {
  SEASONAL_ANNUAL: 'Annuelle (saisonnière)',
  BIENNIAL: 'Bisannuelle',
  PERENNIAL_HERBACEOUS: 'Pérenne herbacée',
  PERENNIAL_WOODY_FRUIT: 'Pérenne ligneuse (fruitière)',
  FORESTRY_WOOD: 'Forestière (bois)',
};

export const SUITABILITY_LABELS: Record<string, string> = {
  SUITABLE: 'Favorable',
  MARGINAL: 'Marginale',
  UNSUITABLE: 'Défavorable',
};

export const OPERATION_TYPE_LABELS: Record<string, string> = {
  CLEARING: 'Défrichage / préparation du sol',
  NURSERY: 'Pépinière',
  PLANTING: 'Plantation / semis',
  SEED_TREATMENT: 'Traitement de semences',
  TRANSPLANTING: 'Repiquage / transplantation',
  FERTILIZATION: 'Fertilisation',
  WEEDING: 'Désherbage / sarclage',
  THINNING: 'Démariage / éclaircissage',
  EARTHING_UP: 'Buttage / billonnage',
  PEST_CONTROL: 'Traitement phytosanitaire',
  HARVEST: 'Récolte',
  OTHER: 'Autre',
};

export const INPUT_TYPE_LABELS: Record<string, string> = {
  CHEMICAL: 'Chimique',
  ORGANIC: 'Bio',
  MIXED: 'Combinaison',
};

export const SUSCEPTIBILITY_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Modérée',
  HIGH: 'Élevée',
};

export const NUTRITION_BASIS_LABELS: Record<string, string> = {
  PER_HECTARE: 'Par hectare (kg/ha)',
  PER_TONNE: 'Par tonne de récolte (kg/t)',
};

export const PEST_TYPE_LABELS: Record<string, string> = {
  INSECT: 'Insecte',
  FUNGUS: 'Champignon (maladie fongique)',
  BACTERIA: 'Bactérie',
  VIRUS: 'Virus',
  WEED: 'Adventice (mauvaise herbe)',
  NEMATODE: 'Nématode',
  OTHER: 'Autre',
};

export const CROP_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publiée',
  ARCHIVED: 'Archivée',
};

export const CONTROL_CATEGORY_LABELS: Record<string, string> = {
  PREVENTION: 'Prévention',
  BIOLOGICAL: 'Lutte biologique',
  INTEGRATED: 'Lutte intégrée',
  CHEMICAL: 'Lutte chimique',
};

export const SEASONS: readonly string[] = ['Saison des pluies', 'Saison sèche', 'Contre-saison'];

// Résout un code en FR ; repli défensif sur le code si non mappé (jamais de blanc).
export function labelOf(map: Record<string, string>, code: string): string {
  return map[code] ?? code;
}

// Résout un nom de stade en « nom (Jx–Jy) » via la phénologie ; repli sur le nom seul.
export function stageWithRange(
  name: string,
  phenology: { name: Record<string, string>; startDay: number; endDay: number }[],
): string {
  const s = phenology.find((p) => (p.name.fr ?? '') === name);
  return s ? `${name} (J${s.startDay}–J${s.endDay})` : name;
}
