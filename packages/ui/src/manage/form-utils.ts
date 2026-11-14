/** ISO string → value for <input type="datetime-local"> (local time). */
export const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** datetime-local value → ISO string (or undefined when empty). */
export const fromLocalInput = (value: string): string | undefined => (value ? new Date(value).toISOString() : undefined);

/** Zod issues → { "path.to.field": "message" }. */
export const issuesToErrors = (issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> =>
  Object.fromEntries(issues.map((i) => [i.path.map(String).join('.'), i.message]));

export const slugifyInput = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
