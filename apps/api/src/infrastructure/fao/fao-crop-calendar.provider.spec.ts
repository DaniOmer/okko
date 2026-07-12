import { FaoCropCalendarProvider } from './fao-crop-calendar.provider';

describe('FaoCropCalendarProvider', () => {
  let provider: FaoCropCalendarProvider;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new FaoCropCalendarProvider();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // Synthetic sample: array of rows with stage/month fields
  // ---------------------------------------------------------------------------
  const SYNTHETIC_ROWS = [
    { country_name: 'Benin', crop_name: 'Maize', crop_process: 'Sowing', stage: 'Start', month: 'June' },
    { country_name: 'Benin', crop_name: 'Maize', crop_process: 'Sowing', stage: 'End',   month: 'July' },
  ];

  function mockFetchOk(body: unknown) {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => body,
    } as Response);
  }

  // ---------------------------------------------------------------------------
  // Happy path: month labels → YYYY-MM-DD dates
  // ---------------------------------------------------------------------------
  it('maps June → 2000-06-01 (sowingStart) and July → 2000-07-31 (sowingEnd)', async () => {
    mockFetchOk(SYNTHETIC_ROWS);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).not.toBeNull();
    expect(result!.sowingStart).toBe('2000-06-01');
    expect(result!.sowingEnd).toBe('2000-07-31');
    expect(result!.sourceRef).toContain('FAO Crop Calendar');
  });

  it('accepts rows wrapped in a { data: [...] } envelope', async () => {
    mockFetchOk({ data: SYNTHETIC_ROWS });

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).not.toBeNull();
    expect(result!.sowingStart).toBe('2000-06-01');
  });

  it('handles period range field ("Jun - Jul") when no stage rows present', async () => {
    mockFetchOk([
      { country_name: 'Benin', crop_name: 'Maize', crop_process: 'Sowing', period: 'Jun - Jul' },
    ]);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).not.toBeNull();
    expect(result!.sowingStart).toBe('2000-06-01');
    expect(result!.sowingEnd).toBe('2000-07-31');
  });

  it('handles numeric month values (6 = June start, 7 = July end)', async () => {
    mockFetchOk([
      { country_name: 'Benin', crop_name: 'Maize', stage: 'Start', month: 6 },
      { country_name: 'Benin', crop_name: 'Maize', stage: 'End',   month: 7 },
    ]);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).not.toBeNull();
    expect(result!.sowingStart).toBe('2000-06-01');
    expect(result!.sowingEnd).toBe('2000-07-31');
  });

  it('correctly computes last day: December → 2000-12-31', async () => {
    mockFetchOk([
      { country_name: 'Benin', crop_name: 'Maize', stage: 'Start', month: 'November' },
      { country_name: 'Benin', crop_name: 'Maize', stage: 'End',   month: 'December' },
    ]);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result!.sowingEnd).toBe('2000-12-31');
  });

  it('correctly computes last day: February → 2000-02-29 (2000 is a leap year)', async () => {
    mockFetchOk([
      { country_name: 'Benin', crop_name: 'Maize', stage: 'Start', month: 'January' },
      { country_name: 'Benin', crop_name: 'Maize', stage: 'End',   month: 'February' },
    ]);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result!.sowingEnd).toBe('2000-02-29');
  });

  // ---------------------------------------------------------------------------
  // Graceful null cases
  // ---------------------------------------------------------------------------
  it('returns null for unknown ISO2 country code', async () => {
    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'XX' });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when fetch rejects (network error)', async () => {
    fetchSpy.mockRejectedValue(new Error('Network failure'));

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).toBeNull();
  });

  it('returns null when HTTP response is non-2xx (502)', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 502 } as Response);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).toBeNull();
  });

  it('returns null when response JSON is not parseable', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Response);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).toBeNull();
  });

  it('returns null when response array is empty', async () => {
    mockFetchOk([]);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).toBeNull();
  });

  it('returns null when no rows match the requested country', async () => {
    mockFetchOk([
      { country_name: 'Ghana', crop_name: 'Maize', stage: 'Start', month: 'June' },
      { country_name: 'Ghana', crop_name: 'Maize', stage: 'End',   month: 'July' },
    ]);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).toBeNull();
  });

  it('returns null when month labels cannot be parsed', async () => {
    mockFetchOk([
      { country_name: 'Benin', crop_name: 'Maize', stage: 'Start', month: 'unknown' },
      { country_name: 'Benin', crop_name: 'Maize', stage: 'End',   month: 'unknown' },
    ]);

    const result = await provider.getSowingWindow({ faoCode: 'Maize', country: 'BJ' });

    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // parseResponse unit tests (public for testability)
  // ---------------------------------------------------------------------------
  describe('parseResponse (unit)', () => {
    it('returns null for null input', () => {
      expect(provider.parseResponse(null, 'Benin', 'Maize')).toBeNull();
    });

    it('returns null for a string input', () => {
      expect(provider.parseResponse('not-json', 'Benin', 'Maize')).toBeNull();
    });

    it('returns null for an object with no recognised array key', () => {
      expect(provider.parseResponse({ other: 42 }, 'Benin', 'Maize')).toBeNull();
    });
  });
});
