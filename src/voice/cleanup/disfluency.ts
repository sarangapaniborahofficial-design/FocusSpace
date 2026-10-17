/**
 * FocusSpace Voice Studio — Disfluency & Speech Cleanup Engine
 * 
 * Strict deterministic Light rules per Voice Implementation Guide:
 * 1. Remove standalone fillers: um, umm, uh, uhh, er, erm, hmm, mm, ah (case-insensitive) + adjacent comma.
 * 2. Collapse immediate duplicate words ONLY for the whitelist:
 *    [I, the, a, an, to, and, of, in, on, we, it, my, but, or, for]
 *    Never collapse others ("had had", "that that", "no no", "very very").
 * 3. Fix whitespace and space-before-punctuation; ensure sentence-initial capital.
 * 4. Voice commands when whole utterance matches (ignoring punctuation):
 *    "new line", "new paragraph", "scratch that".
 * 5. Strictly do NOT touch "like", "so", "basically", "you know", "I mean".
 */

export type VoiceCommand = 'new-line' | 'new-paragraph' | 'scratch-that';

export interface CleanLightResult {
  text: string;
  command: VoiceCommand | null;
}

const FILLERS = ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'hmm', 'mm', 'ah'];
const FILLER_REGEX = new RegExp(`\\b(${FILLERS.join('|')})\\b[,\\s]*`, 'gi');

const DUPLICATE_WHITELIST = new Set([
  'i', 'the', 'a', 'an', 'to', 'and', 'of', 'in', 'on', 'we', 'it', 'my', 'but', 'or', 'for',
]);

/**
 * Checks if the whole utterance matches a known voice command.
 */
export function detectVoiceCommand(raw: string): VoiceCommand | null {
  const norm = raw
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '')
    .replace(/\s+/g, ' ');

  if (norm === 'new line') return 'new-line';
  if (norm === 'new paragraph') return 'new-paragraph';
  if (norm === 'scratch that') return 'scratch-that';

  return null;
}

/**
 * Collapses duplicate consecutive words ONLY if they are in the duplicate whitelist.
 * Example: "to to" -> "to", "I I" -> "I", but "had had" remains "had had".
 */
function collapseAllowedDuplicates(text: string): string {
  // Matches consecutive words separated by whitespace: \b(\w+)\s+\1\b
  return text.replace(/\b([a-zA-Z]+)\s+\1\b/gi, (match, word: string) => {
    if (DUPLICATE_WHITELIST.has(word.toLowerCase())) {
      return word;
    }
    return match;
  });
}

/**
 * Cleans punctuation spacing, removes orphan commas, collapses multi-spaces.
 */
function cleanPunctuationAndSpacing(text: string): string {
  return text
    // Remove space before punctuation: "word , next" -> "word, next"
    .replace(/\s+([.,!?;:])/g, '$1')
    // Remove leading commas/periods: ", Call David" -> "Call David"
    .replace(/^[.,!?;:\s]+/, '')
    // Collapse multiple spaces into one
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Capitalizes the first non-whitespace character if it is a letter.
 */
function capitalizeFirstChar(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Pure function to sanitize and format raw transcribed speech.
 */
export function cleanLight(raw: string): CleanLightResult {
  if (!raw || !raw.trim()) {
    return { text: '', command: null };
  }

  // 1. Check whole-utterance voice commands
  const command = detectVoiceCommand(raw);
  if (command) {
    if (command === 'new-line') return { text: '\n', command };
    if (command === 'new-paragraph') return { text: '\n\n', command };
    if (command === 'scratch-that') return { text: '', command };
  }

  // 2. Remove standalone fillers and adjacent commas in a loop until convergence
  let cleaned = raw;
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(FILLER_REGEX, '');
  }

  // 3. Clean up any weird comma artifacts like " ," or leading/trailing commas
  cleaned = cleanPunctuationAndSpacing(cleaned);

  // 4. Collapse duplicate words only if in whitelist (run twice in case of 3x duplicates "to to to")
  cleaned = collapseAllowedDuplicates(cleaned);
  cleaned = collapseAllowedDuplicates(cleaned);

  // 5. Final spacing & punctuation cleanup
  cleaned = cleanPunctuationAndSpacing(cleaned);

  // 6. Sentence-initial capital
  cleaned = capitalizeFirstChar(cleaned);

  return {
    text: cleaned,
    command: null,
  };
}
