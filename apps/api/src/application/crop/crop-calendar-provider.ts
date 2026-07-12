export interface SowingWindowSuggestion {
  sowingStart: string;
  sowingEnd: string;
  sourceRef: string;
}

export interface CropCalendarProvider {
  getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null>;
}

export const CROP_CALENDAR_PROVIDER = Symbol('CROP_CALENDAR_PROVIDER');
