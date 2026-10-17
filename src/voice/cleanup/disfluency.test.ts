import { describe, expect, it } from 'vitest';
import { cleanLight, detectVoiceCommand } from './disfluency';

describe('Voice Studio Disfluency & Cleanup Engine (cleanLight)', () => {
  it('removes standalone fillers and handles adjacent commas', () => {
    const res = cleanLight('Uh, call David um tomorrow.');
    expect(res.text).toBe('Call David tomorrow.');
    expect(res.command).toBeNull();
  });

  it('collapses immediate duplicate words on the whitelist', () => {
    const res = cleanLight('I need to to email Sarah');
    expect(res.text).toBe('I need to email Sarah');
  });

  it('preserves words like "like", "so", "basically"', () => {
    const res = cleanLight('I like it');
    expect(res.text).toBe('I like it');

    const res2 = cleanLight('So basically it is good');
    expect(res2.text).toBe('So basically it is good');
  });

  it('does NOT collapse duplicates outside the whitelist', () => {
    const res = cleanLight('He had had enough');
    expect(res.text).toBe('He had had enough');

    const res2 = cleanLight('That that was good');
    expect(res2.text).toBe('That that was good');

    const res3 = cleanLight('No no, that is fine');
    expect(res3.text).toBe('No no, that is fine');

    const res4 = cleanLight('It was very very fast');
    expect(res4.text).toBe('It was very very fast');
  });

  it('handles solitary fillers or empty strings by returning empty text', () => {
    expect(cleanLight('um').text).toBe('');
    expect(cleanLight('  uh  ').text).toBe('');
    expect(cleanLight('hmm').text).toBe('');
    expect(cleanLight('').text).toBe('');
    expect(cleanLight('   ').text).toBe('');
  });

  it('detects voice commands when whole utterance matches', () => {
    expect(detectVoiceCommand('new line')).toBe('new-line');
    expect(detectVoiceCommand('New Line.')).toBe('new-line');
    expect(cleanLight('new line').command).toBe('new-line');
    expect(cleanLight('new line').text).toBe('\n');

    expect(detectVoiceCommand('new paragraph')).toBe('new-paragraph');
    expect(cleanLight('New paragraph!').command).toBe('new-paragraph');
    expect(cleanLight('New paragraph!').text).toBe('\n\n');

    expect(detectVoiceCommand('scratch that')).toBe('scratch-that');
    expect(cleanLight('scratch that').command).toBe('scratch-that');
    expect(cleanLight('scratch that').text).toBe('');
  });

  it('does not trigger voice command if phrase is embedded in a longer sentence', () => {
    const res = cleanLight('I need a new line of code here');
    expect(res.command).toBeNull();
    expect(res.text).toBe('I need a new line of code here');
  });

  it('ensures sentence-initial capitalization and fixes punctuation spacing', () => {
    const res = cleanLight('meeting with team at 3pm , don\'t forget');
    expect(res.text).toBe("Meeting with team at 3pm, don't forget");
  });

  it('handles multiple consecutive fillers', () => {
    const res = cleanLight('Um, uh, let us start the timer');
    expect(res.text).toBe('Let us start the timer');
  });

  it('loops filler removal until convergence for consecutive identical fillers', () => {
    const res = cleanLight('um um I think');
    expect(res.text).toBe('I think');
    const res2 = cleanLight('uh uh uh we can do this');
    expect(res2.text).toBe('We can do this');
  });

  it('handles 3x duplicate whitelist words', () => {
    const res = cleanLight('We need to to to finish');
    expect(res.text).toBe('We need to finish');
  });
});
