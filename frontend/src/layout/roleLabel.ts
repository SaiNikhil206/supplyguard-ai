/** PROCUREMENT_MANAGER -> "Procurement Manager". */
export const roleLabel = (r: string): string =>
  r
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
