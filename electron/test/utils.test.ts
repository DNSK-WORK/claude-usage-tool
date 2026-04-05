import { describe, it, expect } from 'vitest';
import { formatResetTime, pruneOldReadings, computeBurnRateFromReadings, formatCost } from '../utils';

// ---------------------------------------------------------------------------
// formatResetTime
// ---------------------------------------------------------------------------
describe('formatResetTime', () => {
  it('returns empty string for undefined', () => {
    expect(formatResetTime()).toBe('');
    expect(formatResetTime(undefined)).toBe('');
    expect(formatResetTime('')).toBe('');
  });

  it('parses English hours+minutes', () => {
    expect(formatResetTime('2hr 30min remaining')).toBe('2hr 30min');
    expect(formatResetTime('1hr 0min')).toBe('1hr 0min');
  });

  it('parses English minutes only', () => {
    expect(formatResetTime('45 min left')).toBe('45min');
  });

  it('parses Korean hours+minutes', () => {
    expect(formatResetTime('2시간 30분')).toBe('2hr 30min');
    expect(formatResetTime('1시간')).toBe('1hr');
  });

  it('parses Korean minutes only', () => {
    expect(formatResetTime('45분')).toBe('45min');
  });

  it('parses Reset date string', () => {
    expect(formatResetTime('Resets April 6')).toBe('April 6');
  });

  it('truncates long Reset strings to 20 chars', () => {
    const long = 'Resets at some really long date string here';
    expect(formatResetTime(long).length).toBeLessThanOrEqual(20);
  });

  it('returns empty for unrecognised format', () => {
    expect(formatResetTime('some random text')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// pruneOldReadings
// ---------------------------------------------------------------------------
describe('pruneOldReadings', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  it('keeps recent entries', () => {
    const readings = [{ ts: now - day, pct: 50 }, { ts: now, pct: 60 }];
    expect(pruneOldReadings(readings)).toHaveLength(2);
  });

  it('removes entries older than 7 days', () => {
    const readings = [
      { ts: now - 8 * day, pct: 20 },
      { ts: now - 3 * day, pct: 50 },
      { ts: now, pct: 70 },
    ];
    const result = pruneOldReadings(readings);
    expect(result).toHaveLength(2);
    expect(result[0].pct).toBe(50);
  });

  it('returns empty array when all entries are old', () => {
    const readings = [{ ts: now - 10 * day, pct: 30 }];
    expect(pruneOldReadings(readings)).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(pruneOldReadings([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeBurnRateFromReadings
// ---------------------------------------------------------------------------
describe('computeBurnRateFromReadings', () => {
  it('returns zero/null for empty readings', () => {
    expect(computeBurnRateFromReadings([], 50)).toEqual({ ratePerHour: 0, etaMinutes: null });
  });

  it('returns zero/null for single reading', () => {
    expect(computeBurnRateFromReadings([{ ts: 0, pct: 10 }], 10)).toEqual({ ratePerHour: 0, etaMinutes: null });
  });

  it('returns zero/null when usage has not increased', () => {
    const readings = [{ ts: 0, pct: 50 }, { ts: 3600000, pct: 50 }];
    expect(computeBurnRateFromReadings(readings, 50)).toEqual({ ratePerHour: 0, etaMinutes: null });
  });

  it('computes correct rate for 10% over 1 hour', () => {
    const readings = [{ ts: 0, pct: 0 }, { ts: 3600000, pct: 10 }];
    const result = computeBurnRateFromReadings(readings, 10);
    expect(result.ratePerHour).toBeCloseTo(10);
    // ETA: (100 - 10) / (10/60) = 540 minutes
    expect(result.etaMinutes).toBeCloseTo(540);
  });

  it('returns null for etaMinutes when > 24 hours away', () => {
    // 1% over 1 hour — ETA = 99/1 * 60 = 5940 min > 1440
    const readings = [{ ts: 0, pct: 0 }, { ts: 3600000, pct: 1 }];
    const result = computeBurnRateFromReadings(readings, 1);
    expect(result.etaMinutes).toBeNull();
    expect(result.ratePerHour).toBeCloseTo(1);
  });

  it('handles usage at 100% — ETA is 0', () => {
    const readings = [{ ts: 0, pct: 90 }, { ts: 3600000, pct: 100 }];
    const result = computeBurnRateFromReadings(readings, 100);
    expect(result.etaMinutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatCost
// ---------------------------------------------------------------------------
describe('formatCost', () => {
  it('formats zero', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('formats small amounts', () => {
    expect(formatCost(0.001)).toBe('<$0.01');
  });

  it('formats normal amounts', () => {
    expect(formatCost(1.5)).toBe('$1.50');
    expect(formatCost(12.345)).toBe('$12.35');
  });

  it('handles NaN gracefully', () => {
    expect(formatCost(NaN)).toBe('$—');
  });

  it('handles Infinity gracefully', () => {
    expect(formatCost(Infinity)).toBe('$—');
    expect(formatCost(-Infinity)).toBe('$—');
  });
});
