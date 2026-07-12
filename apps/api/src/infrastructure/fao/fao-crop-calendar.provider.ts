import { CropCalendarProvider, SowingWindowSuggestion } from '../../application/crop/crop-calendar-provider';

/**
 * Mapping ISO 3166-1 alpha-2 → FAO country name used in the crop calendar.
 * Best-effort list focused on West Africa + a few reference countries.
 */
const ISO2_TO_FAO_COUNTRY: Record<string, string> = {
  BJ: 'Benin',
  BF: 'Burkina Faso',
  CI: "Cote d'Ivoire",
  GH: 'Ghana',
  GN: 'Guinea',
  ML: 'Mali',
  MR: 'Mauritania',
  NE: 'Niger',
  NG: 'Nigeria',
  SN: 'Senegal',
  TG: 'Togo',
  GM: 'Gambia',
  GW: 'Guinea-Bissau',
  LR: 'Liberia',
  SL: 'Sierra Leone',
  CM: 'Cameroon',
  CD: 'Dem. Rep. of the Congo',
  CF: 'Central African Republic',
  CG: 'Congo',
  GA: 'Gabon',
  ET: 'Ethiopia',
  KE: 'Kenya',
  TZ: 'Tanzania',
  UG: 'Uganda',
  RW: 'Rwanda',
  BI: 'Burundi',
  SD: 'Sudan',
  MZ: 'Mozambique',
  ZW: 'Zimbabwe',
  ZM: 'Zambia',
  MW: 'Malawi',
  IN: 'India',
  CN: 'China',
  BR: 'Brazil',
  US: 'United States of America',
  FR: 'France',
};

const MONTHS_IN_YEAR = 12;

/** Returns the last day of a given month in year 2000 */
function lastDayOfMonth(month: number): number {
  // Month is 1-based; day 0 of next month = last day of current month
  return new Date(2000, month, 0).getDate();
}

/** Converts a month number (1–12) to 'YYYY-MM-01' format with neutral year 2000 */
function toStartDate(month: number): string {
  return `2000-${String(month).padStart(2, '0')}-01`;
}

/** Converts a month number (1–12) to 'YYYY-MM-DD' format (last day) with neutral year 2000 */
function toEndDate(month: number): string {
  const last = lastDayOfMonth(month);
  return `2000-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/**
 * Parse a month label such as "June", "Jun", "6", or "Jun - Jul" to a month number (1–12).
 * Returns null if parsing fails.
 */
function parseMonthLabel(label: string): number | null {
  const monthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];
  const trimmed = label.trim().toLowerCase();
  // Try numeric
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= MONTHS_IN_YEAR) return num;
  // Try name or 3-letter abbreviation (take the first token if it's a range like "Jun - Jul")
  const firstToken = trimmed.split(/[\s\-–]+/)[0].slice(0, 3);
  const idx = monthNames.indexOf(firstToken);
  if (idx >= 0) return idx + 1;
  return null;
}

/**
 * Shape of one row returned by the FAO BigQuery parameterized query.
 * Fields are inferred from the SQL schema and FAO data catalog documentation.
 * The query returns rows filtered by crop_process and crop; each row represents
 * one country + stage (Start or End) combination.
 */
interface FaoCalendarRow {
  country?: string;
  country_name?: string;
  crop?: string;
  crop_name?: string;
  crop_process?: string;
  stage?: string;
  month?: string | number;
  period?: string;
  [key: string]: unknown;
}

/**
 * FAO BigQuery parameterized SQL query URL for crop calendar (by country, crop, activity, stage).
 * This is the publicly available parameterized query published by FAO.
 */
const FAO_SQL_URL =
  'https://data.apps.fao.org/catalog/dataset/84d65264-74c1-4160-b5ba-ba23a4bd73d5/resource/' +
  '6676053b-5f12-4d96-b436-7b666184e6e6/download/crop-calendar-parameterized-query-month-start-end.sql';

const FAO_BIGQUERY_BASE = 'https://api.data.apps.fao.org/api/v2/bigquery';

export class FaoCropCalendarProvider implements CropCalendarProvider {
  async getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null> {
    try {
      const faoCountry = ISO2_TO_FAO_COUNTRY[input.country.toUpperCase()];
      if (!faoCountry) return null;

      const url = new URL(FAO_BIGQUERY_BASE);
      url.searchParams.set('sql_url', FAO_SQL_URL);
      url.searchParams.set('crop_process', 'Sowing');
      url.searchParams.set('crop', input.faoCode);

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) return null;

      const data: unknown = await response.json();

      return this.parseResponse(data, faoCountry, input.faoCode);
    } catch {
      return null;
    }
  }

  /**
   * Parse the FAO API response. The response may be:
   * - An array of row objects: [{ country_name, crop_name, crop_process, stage, month, ... }]
   * - Or a wrapper object: { data: [...], ... }
   *
   * We look for rows matching the target country, then extract Start and End stage months.
   */
  parseResponse(data: unknown, faoCountry: string, faoCode: string): SowingWindowSuggestion | null {
    try {
      let rows: FaoCalendarRow[] = [];

      if (Array.isArray(data)) {
        rows = data as FaoCalendarRow[];
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj['data'])) {
          rows = obj['data'] as FaoCalendarRow[];
        } else if (Array.isArray(obj['rows'])) {
          rows = obj['rows'] as FaoCalendarRow[];
        }
      }

      if (rows.length === 0) return null;

      const countryLower = faoCountry.toLowerCase();
      const cropLower = faoCode.toLowerCase();

      // Filter to rows matching country and crop (case-insensitive)
      const countryRows = rows.filter((r) => {
        const rowCountry = (r.country_name ?? r.country ?? '').toString().toLowerCase();
        const rowCrop = (r.crop_name ?? r.crop ?? '').toString().toLowerCase();
        return rowCountry === countryLower && rowCrop === cropLower;
      });

      if (countryRows.length === 0) return null;

      // Find Start and End stage rows
      const startRow = countryRows.find((r) => {
        const stage = (r.stage ?? '').toString().toLowerCase();
        return stage === 'start' || stage.includes('start');
      });
      const endRow = countryRows.find((r) => {
        const stage = (r.stage ?? '').toString().toLowerCase();
        return stage === 'end' || stage.includes('end');
      });

      // If no stage distinction, try to parse period field (e.g., "Jun - Jul")
      if (!startRow && !endRow) {
        const anyRow = countryRows[0];
        const period = (anyRow.period ?? anyRow.month ?? '').toString();
        const parts = period.split(/[\-–]/);
        if (parts.length >= 2) {
          const startMonth = parseMonthLabel(parts[0]);
          const endMonth = parseMonthLabel(parts[parts.length - 1]);
          if (startMonth && endMonth) {
            return {
              sowingStart: toStartDate(startMonth),
              sowingEnd: toEndDate(endMonth),
              sourceRef: `FAO Crop Calendar — ${faoCode} / ${faoCountry}`,
            };
          }
        }
        return null;
      }

      const monthVal = (row: FaoCalendarRow) => row.month ?? row.period ?? null;

      const startMonthRaw = startRow ? monthVal(startRow) : null;
      const endMonthRaw = endRow ? monthVal(endRow) : null;

      const startMonth = startMonthRaw != null ? parseMonthLabel(String(startMonthRaw)) : null;
      const endMonth = endMonthRaw != null ? parseMonthLabel(String(endMonthRaw)) : null;

      if (!startMonth || !endMonth) return null;

      return {
        sowingStart: toStartDate(startMonth),
        sowingEnd: toEndDate(endMonth),
        sourceRef: `FAO Crop Calendar — ${faoCode} / ${faoCountry}`,
      };
    } catch {
      return null;
    }
  }
}
