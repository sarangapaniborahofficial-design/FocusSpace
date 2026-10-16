/**
 * FocusSpace Voice Studio — Word Error Rate (WER) Benchmark Utility
 *
 * Implements standard Levenshtein distance dynamic programming across word tokens
 * to compute Word Error Rate (WER), substitutions, deletions, and insertions.
 */

export interface WerResult {
  wer: number;
  werPercent: string;
  substitutions: number;
  deletions: number;
  insertions: number;
  wordCount: number;
}

/**
 * Normalizes text for speech recognition benchmarking:
 * - lowercase
 * - remove punctuation
 * - collapse whitespace
 */
export function normalizeTranscript(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Computes Word Error Rate (WER) between a reference transcript and hypothesis transcript.
 */
export function calculateWer(reference: string, hypothesis: string): WerResult {
  const refWords = normalizeTranscript(reference);
  const hypWords = normalizeTranscript(hypothesis);

  const n = refWords.length;
  const m = hypWords.length;

  if (n === 0) {
    const isExact = m === 0;
    return {
      wer: isExact ? 0 : 1,
      werPercent: isExact ? '0.0%' : '100.0%',
      substitutions: 0,
      deletions: 0,
      insertions: m,
      wordCount: 0,
    };
  }

  // 2D DP matrix for Levenshtein word distance
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j - 1], // substitution
          dp[i - 1][j],     // deletion
          dp[i][j - 1]      // insertion
        );
      }
    }
  }

  const distance = dp[n][m];
  const wer = parseFloat((distance / n).toFixed(4));
  const werPercent = `${(wer * 100).toFixed(1)}%`;

  // Backtrack to count operations
  let i = n;
  let j = m;
  let s = 0;
  let d = 0;
  let ins = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refWords[i - 1] === hypWords[j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      s++;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      d++;
      i--;
    } else {
      ins++;
      j--;
    }
  }

  return {
    wer,
    werPercent,
    substitutions: s,
    deletions: d,
    insertions: ins,
    wordCount: n,
  };
}
