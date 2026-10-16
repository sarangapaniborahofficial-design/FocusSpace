/**
 * FocusSpace Pure Acoustic Audio Splitter
 *
 * Splits audio longer than 25 seconds into chunks of at most 25 seconds,
 * preferring a split point at the quietest 200ms RMS window within the last 3s of each chunk.
 * Zero-dependency, pure function for offline voice typing.
 */

export interface SplitOptions {
  sampleRate?: number; // Default: 16000
  maxChunkSeconds?: number; // Default: 25
  searchWindowSeconds?: number; // Default: 3
  quietWindowMs?: number; // Default: 200
  stepMs?: number; // Candidate search step in ms, default: 10
}

/**
 * Finds the index within [searchStart, searchEnd] that has the lowest 200ms RMS energy.
 * Returns the split point index (center of the quietest window).
 */
export function findQuietestSplitPoint(
  audio: Float32Array,
  searchStart: number,
  searchEnd: number,
  windowSamples: number,
  stepSamples: number
): number {
  const maxCandidateStart = searchEnd - windowSamples;
  if (maxCandidateStart <= searchStart) {
    return Math.min(audio.length, searchEnd);
  }

  let minEnergy = Infinity;
  let bestWindowStart = searchStart;

  // Evaluate candidate 200ms windows spaced by stepSamples
  for (let candidate = searchStart; candidate <= maxCandidateStart; candidate += stepSamples) {
    let sumSquares = 0;
    for (let i = 0; i < windowSamples; i++) {
      const val = audio[candidate + i];
      sumSquares += val * val;
    }

    if (sumSquares < minEnergy) {
      minEnergy = sumSquares;
      bestWindowStart = candidate;
    }
  }

  // Split at the center of the quietest window to provide a natural silence cushion for both chunks
  return bestWindowStart + Math.floor(windowSamples / 2);
}

/**
 * Splits an audio buffer into chunks of at most maxChunkSeconds (default 25s).
 * If audio <= 25s, returns [audio] unchanged.
 */
export function splitAudio(audio: Float32Array, options?: SplitOptions): Float32Array[] {
  const sampleRate = options?.sampleRate ?? 16000;
  const maxChunkSeconds = options?.maxChunkSeconds ?? 25;
  const searchWindowSeconds = options?.searchWindowSeconds ?? 3;
  const quietWindowMs = options?.quietWindowMs ?? 200;
  const stepMs = options?.stepMs ?? 10;

  const maxChunkSamples = Math.round(maxChunkSeconds * sampleRate);
  const searchWindowSamples = Math.round(searchWindowSeconds * sampleRate);
  const quietWindowSamples = Math.round((quietWindowMs / 1000) * sampleRate);
  const stepSamples = Math.max(1, Math.round((stepMs / 1000) * sampleRate));

  if (!audio || audio.length <= maxChunkSamples) {
    return audio ? [audio] : [];
  }

  const chunks: Float32Array[] = [];
  let currentOffset = 0;

  while (currentOffset < audio.length) {
    const remainingSamples = audio.length - currentOffset;

    if (remainingSamples <= maxChunkSamples) {
      // Last chunk fits within limit
      chunks.push(audio.subarray(currentOffset));
      break;
    }

    // Candidate window is the first maxChunkSamples of remaining audio
    const chunkEnd = currentOffset + maxChunkSamples;
    const searchStart = chunkEnd - searchWindowSamples;

    const splitPoint = findQuietestSplitPoint(
      audio,
      searchStart,
      chunkEnd,
      quietWindowSamples,
      stepSamples
    );

    chunks.push(audio.subarray(currentOffset, splitPoint));
    currentOffset = splitPoint;
  }

  return chunks;
}
