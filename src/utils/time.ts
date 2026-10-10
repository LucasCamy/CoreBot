import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export { dayjs };

/**
 * Format a Date or ISO string in a given timezone
 */
export function formatInTimezone(
  date: Date | string,
  tz: string = 'America/Sao_Paulo',
  formatStr: string = 'DD/MM/YYYY HH:mm:ss',
): string {
  return dayjs(date).tz(tz).format(formatStr);
}

/**
 * Get current time in specified timezone
 */
export function nowInTimezone(tz: string = 'America/Sao_Paulo'): dayjs.Dayjs {
  return dayjs().tz(tz);
}

/**
 * Parse date and time in a specific timezone
 */
export function parseInTimezone(
  dateStr: string,
  formatStr: string,
  tz: string = 'America/Sao_Paulo',
): Date {
  return dayjs.tz(dateStr, formatStr, tz).toDate();
}

/**
 * Attempt to parse a date string across common date/time formats
 */
export function parseDateTime(dateStr: string, tz: string = 'America/Sao_Paulo'): Date | null {
  const formats = [
    'DD/MM/YYYY HH:mm',
    'DD/MM/YYYY HH:mm:ss',
    'DD/MM/YYYY',
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD',
    'DD-MM-YYYY HH:mm',
    'DD-MM-YYYY',
  ];

  for (const fmt of formats) {
    const parsed = dayjs.tz(dateStr, fmt, tz);
    if (parsed.isValid()) {
      return parsed.toDate();
    }
  }

  const fallback = dayjs(dateStr);
  return fallback.isValid() ? fallback.toDate() : null;
}
