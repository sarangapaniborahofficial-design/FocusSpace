import { describe, it, expect } from 'vitest';
import { calculateWer, normalizeTranscript } from './wer';

describe('Word Error Rate (WER) computation', () => {
  it('normalizes transcripts properly', () => {
    expect(normalizeTranscript('Hello, World! This is a TEST.')).toEqual([
      'hello',
      'world',
      'this',
      'is',
      'a',
      'test',
    ]);
  });

  it('computes 0% WER for identical transcripts', () => {
    const res = calculateWer('Ship the release today', 'ship the release today');
    expect(res.wer).toBe(0);
    expect(res.werPercent).toBe('0.0%');
    expect(res.substitutions).toBe(0);
    expect(res.deletions).toBe(0);
    expect(res.insertions).toBe(0);
  });

  it('computes substitution correctly', () => {
    const res = calculateWer('meet at four pm', 'meet at five pm');
    expect(res.substitutions).toBe(1);
    expect(res.deletions).toBe(0);
    expect(res.insertions).toBe(0);
    expect(res.wer).toBe(0.25);
    expect(res.werPercent).toBe('25.0%');
  });

  it('computes deletion correctly', () => {
    const res = calculateWer('start the timer now', 'start timer now');
    expect(res.substitutions).toBe(0);
    expect(res.deletions).toBe(1);
    expect(res.insertions).toBe(0);
    expect(res.wer).toBe(0.25);
    expect(res.werPercent).toBe('25.0%');
  });

  it('computes insertion correctly', () => {
    const res = calculateWer('read notes', 'please read the notes');
    expect(res.substitutions).toBe(0);
    expect(res.deletions).toBe(0);
    expect(res.insertions).toBe(2);
    expect(res.wer).toBe(1.0);
    expect(res.werPercent).toBe('100.0%');
  });

  it('handles empty reference transcript', () => {
    const emptyRef = calculateWer('', '');
    expect(emptyRef.wer).toBe(0);

    const nonEmptHyp = calculateWer('', 'something said');
    expect(nonEmptHyp.wer).toBe(1);
  });
});
