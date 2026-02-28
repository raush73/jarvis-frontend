/**
 * Formats a digits-only phone string into US format: (XXX) XXX-XXXX
 * Accepts:
 * - 10 digits
 * - 11 digits starting with "1" (US country code)
 *
 * Returns the original value unmodified if input is missing or not a recognizable US number.
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return value ?? "";
  const digits = value.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return value;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}
