// Combines the Google account name with the optional Settings name into a
// single "Updated By"/"Checked by" value, e.g. "Jane Doe (Warehouse 2)".
export function formatCheckedBy(displayName: string | null, alias: string | null): string {
  if (displayName && alias) return `${displayName} (${alias})`;
  return displayName || alias || '';
}
