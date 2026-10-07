/**
 * Marks a phone number, amount or code as left-to-right when it is dropped
 * into translated text, so "+254 712 345 678" doesn't scramble inside Arabic.
 * (Unicode LEFT-TO-RIGHT ISOLATE … POP DIRECTIONAL ISOLATE.)
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}
