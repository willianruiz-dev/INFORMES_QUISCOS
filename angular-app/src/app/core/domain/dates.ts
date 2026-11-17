/** Local calendar dates: never use toISOString(), which can shift dates across time zones. */
export function localDate(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function monthRange(now = new Date()): { start: string; end: string } {
  return {
    start: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

export function fortnightRange(now = new Date()): { start: string; end: string } {
  const first = now.getDate() <= 15;
  return {
    start: localDate(new Date(now.getFullYear(), now.getMonth(), first ? 1 : 16)),
    end: localDate(new Date(now.getFullYear(), now.getMonth() + (first ? 0 : 1), first ? 15 : 0))
  };
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1000 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function displayDate(value: string): string {
  if (!validDate(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
