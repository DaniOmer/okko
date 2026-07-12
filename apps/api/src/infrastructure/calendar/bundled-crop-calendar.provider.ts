import data from './crop-calendar.json';
import { CropCalendarProvider, SowingWindowSuggestion } from '../../application/crop/crop-calendar-provider';

interface CalendarRow {
  country: string;
  cropCode: string;
  sowingStart: string;
  sowingEnd: string;
  sourceRef: string;
}

/**
 * Calendrier de semis embarqué, au niveau pays (ISO2 × code FAO).
 * Remplace l'ancien adaptateur FAO live : aucune requête réseau, couvre le Bénin
 * et ses voisins. Fenêtres de départ à valider par l'agronome.
 */
export class BundledCropCalendarProvider implements CropCalendarProvider {
  private readonly rows = data as CalendarRow[];

  async getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null> {
    const country = input.country.toUpperCase();
    const row = this.rows.find((r) => r.country.toUpperCase() === country && r.cropCode === input.faoCode);
    if (!row) return null;
    return { sowingStart: row.sowingStart, sowingEnd: row.sowingEnd, sourceRef: row.sourceRef };
  }
}
