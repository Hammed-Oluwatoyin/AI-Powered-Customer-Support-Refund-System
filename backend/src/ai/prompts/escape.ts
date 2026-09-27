/**
 * Neutralises markup in text placed inside prompt tags, so content such as
 * "</customer_message>" cannot close the tag and pose as instructions.
 */
export function escapeForPrompt(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** JSON.stringify, with < and > escaped so a string cannot close a surrounding tag. */
export function jsonForPrompt(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');
}
