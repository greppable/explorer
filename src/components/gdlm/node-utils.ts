/**
 * Convert "hsl(H S% L%)" to "hsl(H S% L% / a)". Tolerates strings that are
 * already in the alpha-aliased form. Returns the input unchanged if it
 * doesn't contain a parenthesised body (e.g. a hex color).
 */
export function colorWithAlpha(hsl: string, alpha: number): string {
  const open = hsl.indexOf("(");
  const close = hsl.lastIndexOf(")");
  if (open === -1 || close === -1) return hsl;
  const inner = hsl.slice(open + 1, close).trim();
  return `hsl(${inner} / ${alpha})`;
}
