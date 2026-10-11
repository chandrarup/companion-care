/** YYYY-MM-DD in the viewer's LOCAL timezone (Date.toISOString() is UTC and is "tomorrow" on a US evening). */
export function localISODate(d: Date = new Date()): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
