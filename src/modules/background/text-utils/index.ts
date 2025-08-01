/**
 * Normalizes text by converting to lowercase, removing diacritics and non-alphanumeric characters
 */
export function normalizeText(text: string | undefined): string {
  if (!text) return '';
  const DIACRITICAL_MARKS_REGEX = /\p{Diacritic}/gu;
  const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
  const NON_ALPHANUMERIC_REGEX = /[^a-z0-9\s]/g; // Added to remove non-alphanumeric characters
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICAL_MARKS_REGEX, '')
    .replace(NON_ALPHANUMERIC_REGEX, '') // Remove non-alphanumeric characters
    .replace(MULTIPLE_WHITESPACE_REGEX, ' ')
    .trim();
}
