import { SuggestSowingWindowUseCase } from './suggest-sowing-window.use-case';
import { InMemoryZoneRepository } from '../zone/in-memory-zone.repository';
import { ZoneNotFoundError } from '../zone/set-crop-zone-suitability.use-case';
import { SowingWindowSuggestion, CropCalendarProvider } from './crop-calendar-provider';

const SUGGESTION: SowingWindowSuggestion = {
  sowingStart: '2000-06-01',
  sowingEnd: '2000-07-31',
  sourceRef: 'FAO Crop Calendar',
};

function makeStubProvider(result: SowingWindowSuggestion | null): CropCalendarProvider & { lastInput: { faoCode: string; country: string } | null } {
  const stub = {
    lastInput: null as { faoCode: string; country: string } | null,
    async getSowingWindow(input: { faoCode: string; country: string }): Promise<SowingWindowSuggestion | null> {
      stub.lastInput = input;
      return result;
    },
  };
  return stub;
}

describe('SuggestSowingWindowUseCase', () => {
  let zones: InMemoryZoneRepository;
  let zoneId: string;

  beforeEach(async () => {
    zones = new InMemoryZoneRepository();
    zoneId = 'zone-bj-1';
    await zones.save({
      id: zoneId,
      name: { fr: 'Bénin Sud' },
      country: 'BJ',
      metadata: {},
    });
  });

  it('returns the suggestion and passes the zone country to the provider', async () => {
    const provider = makeStubProvider(SUGGESTION);
    const uc = new SuggestSowingWindowUseCase(zones, provider);

    const result = await uc.execute({ faoCode: 'Maize', zoneId });

    expect(result).toEqual(SUGGESTION);
    expect(provider.lastInput).toEqual({ faoCode: 'Maize', country: 'BJ' });
  });

  it('returns null when the provider returns null', async () => {
    const provider = makeStubProvider(null);
    const uc = new SuggestSowingWindowUseCase(zones, provider);

    const result = await uc.execute({ faoCode: 'Maize', zoneId });

    expect(result).toBeNull();
  });

  it('throws ZoneNotFoundError when the zone does not exist', async () => {
    const provider = makeStubProvider(SUGGESTION);
    const uc = new SuggestSowingWindowUseCase(zones, provider);

    await expect(uc.execute({ faoCode: 'Maize', zoneId: 'nonexistent' }))
      .rejects.toThrow(ZoneNotFoundError);
  });
});
