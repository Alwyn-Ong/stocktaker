const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Formats in UTC+8 regardless of the device's local timezone setting.
export function formatGMT8(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + GMT8_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = pad(shifted.getUTCMonth() + 1);
  const d = pad(shifted.getUTCDate());
  const hh = pad(shifted.getUTCHours());
  const mm = pad(shifted.getUTCMinutes());
  const ss = pad(shifted.getUTCSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss} (UTC+8)`;
}
