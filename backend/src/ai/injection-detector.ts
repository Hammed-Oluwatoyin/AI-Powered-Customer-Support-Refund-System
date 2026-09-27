import { Injectable } from '@nestjs/common';

export interface InjectionScan {
  suspected: boolean;
  /** IDs of the heuristics that matched, for the audit log. */
  matches: string[];
}

/**
 * Heuristic prompt-injection detection that does not depend on the model.
 * It runs next to the model's own `injectionSuspected` flag, and either one
 * is enough to escalate (P8).
 *
 * The patterns are phrase-level on purpose: an ordinary request such as
 * "please approve my refund" must not trip them. Text is normalised first,
 * so zero-width characters, full-width letters or line breaks don't hide a
 * phrase. The model catches subtler attempts, such as look-alike letters
 * from other alphabets, that these patterns miss.
 */
const HEURISTICS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  {
    id: 'override-instructions',
    pattern:
      // The gap stops at commas, so "ignore the dent, the instructions were
      // fine" is not flagged.
      /\b(ignore|disregard|forget|override|bypass)\b[^.!?,;]{0,40}\b(rules?|instructions?|polic(?:y|ies)|guidelines|prompts?|directives?)\b/i,
  },
  {
    id: 'role-reassignment',
    pattern:
      /\byou are (?:now|no longer)\b|\bpretend (?:to be|you are)\b|\bact as (?:an?|the) (?:admin|administrator|manager|developer|system)\b/i,
  },
  {
    id: 'system-prompt-reference',
    pattern: /\bsystem prompt\b|\b(?:initial|original|hidden) instructions\b/i,
  },
  {
    id: 'mode-switch',
    pattern: /\b(?:developer|dev|debug|admin|god|jailbreak|DAN) mode\b/i,
  },
  {
    id: 'dictated-decision',
    pattern:
      /\b(?:approve|authori[sz]e|grant)\b[^.!?]{0,40}\brefund\b[^.!?]{0,40}\b(?:regardless|no matter what|without (?:checking|review|verification|question))\b|\byou (?:must|have to|are required to)\b[^.!?]{0,30}\b(?:approve|refund)\b/i,
  },
  {
    id: 'fake-markup',
    pattern:
      /<\/?\s*(?:customer_message|customer_orders|decision|system|assistant|instructions?)\b[^>]*>|\[\/?(?:system|inst)\]|^\s*(?:system|assistant)\s*:/im,
  },
  {
    id: 'output-manipulation',
    pattern:
      /["']?\b(?:injectionSuspected|confidence|decision|rulesFired)\b["']?\s*[:=]/i,
  },
];

/**
 * Undoes cheap obfuscation before matching: NFKC turns full-width and other
 * compatibility letters into plain ones, invisible format characters
 * (zero-width spaces, joiners, bidi controls) are removed, and runs of
 * spaces and tabs collapse to one space. Line breaks are kept so the
 * line-start patterns still work.
 */
export function normaliseForScan(message: string): string {
  return message
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .replace(/[^\S\n]+/g, ' ');
}

@Injectable()
export class InjectionDetector {
  detect(message: string): InjectionScan {
    const text = normaliseForScan(message);
    const matches = HEURISTICS.filter(({ pattern }) => pattern.test(text)).map(
      ({ id }) => id,
    );
    return { suspected: matches.length > 0, matches };
  }
}
