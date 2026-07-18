import { computeCompleteness } from './crop-completeness';

describe('computeCompleteness', () => {
  it('counts filled categories and computes the percent', () => {
    const report = computeCompleteness({
      climatic: true, edaphic: true, phenology: false, nutrition: false, yields: false,
      varieties: true, zones: false, windows: false, pests: false, prices: false,
      commercialization: false,
    });
    expect(report.total).toBe(11);
    expect(report.filled).toBe(3);
    expect(report.percent).toBe(27);
    expect(report.categories.climatic).toBe(true);
    expect(report.categories.phenology).toBe(false);
  });

  it('reports 100% when everything is filled', () => {
    const all = computeCompleteness({
      climatic: true, edaphic: true, phenology: true, nutrition: true, yields: true,
      varieties: true, zones: true, windows: true, pests: true, prices: true,
      commercialization: true,
    });
    expect(report100(all)).toBe(100);
  });
});

function report100(r: { percent: number }): number { return r.percent; }
