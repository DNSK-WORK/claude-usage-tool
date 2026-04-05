// Pure utility functions — no Electron dependencies, fully testable.

export interface HistoryEntry { ts: number; pct: number; }

/** Parse a reset-time context string into a compact human-readable label. */
export function formatResetTime(context?: string): string {
  if (!context) return '';
  const enMatch = context.match(/(\d+)\s*hr?\s*(\d+)?\s*min?/i);
  if (enMatch) {
    const hours = enMatch[1];
    const minutes = enMatch[2];
    return minutes ? `${hours}hr ${minutes}min` : `${hours}hr`;
  }
  const krMatch = context.match(/(\d+)\s*시간\s*(\d+)?\s*분?/);
  if (krMatch) {
    const hours = krMatch[1];
    const minutes = krMatch[2];
    return minutes ? `${hours}hr ${minutes}min` : `${hours}hr`;
  }
  const minOnly = context.match(/(\d+)\s*min/i) || context.match(/(\d+)\s*분/);
  if (minOnly) return `${minOnly[1]}min`;
  const dateMatch = context.match(/Resets?\s+(.+)/i);
  if (dateMatch) {
    const dateStr = dateMatch[1].trim();
    return dateStr.length <= 20 ? dateStr : dateStr.substring(0, 20);
  }
  return '';
}

/** Prune history entries older than 7 days from a readings array. */
export function pruneOldReadings(readings: HistoryEntry[]): HistoryEntry[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return readings.filter(r => r.ts >= cutoff);
}

/**
 * Compute burn rate and ETA from a readings array.
 * Returns ratePerHour=0, etaMinutes=null when data is insufficient.
 */
export function computeBurnRateFromReadings(
  readings: HistoryEntry[],
  currentPct: number,
): { ratePerHour: number; etaMinutes: number | null } {
  if (readings.length < 2) return { ratePerHour: 0, etaMinutes: null };

  const oldest = readings[0];
  const newest = readings[readings.length - 1];
  const deltaMs = newest.ts - oldest.ts;
  const deltaPct = newest.pct - oldest.pct;

  if (deltaMs <= 0 || deltaPct <= 0) return { ratePerHour: 0, etaMinutes: null };

  const ratePerHour = (deltaPct / deltaMs) * 3600000;
  const ratePerMin = deltaPct / (deltaMs / 60000);
  const remaining = 100 - currentPct;
  const etaMinutes = remaining / ratePerMin;

  if (!isFinite(etaMinutes) || etaMinutes > 1440) return { ratePerHour, etaMinutes: null };

  return { ratePerHour, etaMinutes };
}

/** Format a dollar cost for display. */
export function formatCost(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '$—';
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return '<$0.01';
  return `$${amount.toFixed(2)}`;
}
