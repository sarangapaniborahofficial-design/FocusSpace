import { describe, it, expect } from 'vitest';
import { splitAudio, findQuietestSplitPoint } from './splitter';

describe('splitAudio pure acoustic splitter', () => {
  const SAMPLE_RATE = 16000;
  const SAMPLES_25S = 25 * SAMPLE_RATE; // 400,000

  it('returns single chunk for audio <= 25 seconds', () => {
    const audio10s = new Float32Array(10 * SAMPLE_RATE);
    audio10s.fill(0.2);
    const result10s = splitAudio(audio10s);
    expect(result10s).toHaveLength(1);
    expect(result10s[0].length).toBe(10 * SAMPLE_RATE);

    const audio25s = new Float32Array(SAMPLES_25S);
    audio25s.fill(0.1);
    const result25s = splitAudio(audio25s);
    expect(result25s).toHaveLength(1);
    expect(result25s[0].length).toBe(SAMPLES_25S);
  });

  it('handles empty audio gracefully', () => {
    const empty = new Float32Array(0);
    const res = splitAudio(empty);
    expect(res).toHaveLength(1);
    expect(res[0].length).toBe(0);
  });

  it('splits 30s audio into chunks each <= 25s', () => {
    const audio30s = new Float32Array(30 * SAMPLE_RATE);
    audio30s.fill(0.05);

    const chunks = splitAudio(audio30s);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(SAMPLES_25S);
    }

    // Verify lossless reconstruction
    const totalSamples = chunks.reduce((acc, c) => acc + c.length, 0);
    expect(totalSamples).toBe(audio30s.length);
  });

  it('accurately targets quietest 200ms window in the last 3s of chunk', () => {
    // 28s buffer: 0s to 25s is chunk 1 search region.
    // Last 3s is 22s to 25s.
    // Let's place high energy (amplitude 0.9) everywhere, but inject a silence dip (0.0) at 23.5s to 24.0s (500ms).
    const audio28s = new Float32Array(28 * SAMPLE_RATE);
    audio28s.fill(0.9);

    const silenceStart = Math.round(23.5 * SAMPLE_RATE);
    const silenceEnd = Math.round(24.0 * SAMPLE_RATE);
    for (let i = silenceStart; i < silenceEnd; i++) {
      audio28s[i] = 0.0;
    }

    const chunks = splitAudio(audio28s);
    expect(chunks.length).toBe(2);

    // Chunk 0 split point should be right around the middle of the silence dip (23.5s to 24.0s)
    const splitIndex = chunks[0].length;
    expect(splitIndex).toBeGreaterThanOrEqual(silenceStart);
    expect(splitIndex).toBeLessThanOrEqual(silenceEnd);
  });

  it('splits long audio (>60s) into sequential chunks all <= 25s without loss', () => {
    const audio70s = new Float32Array(70 * SAMPLE_RATE);
    // Fill with sample index sequence to verify perfect reconstruction
    for (let i = 0; i < audio70s.length; i++) {
      audio70s[i] = (i % 100) / 100;
    }

    const chunks = splitAudio(audio70s);
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    let offset = 0;
    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      expect(chunk.length).toBeLessThanOrEqual(SAMPLES_25S);
      expect(chunk.length).toBeGreaterThan(0);

      // Verify slice contents match original exactly
      for (let i = 0; i < Math.min(100, chunk.length); i++) {
        expect(chunk[i]).toBe(audio70s[offset + i]);
      }
      offset += chunk.length;
    }

    expect(offset).toBe(audio70s.length);
  });
});
