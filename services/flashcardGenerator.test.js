import { describe, it, expect, vi } from 'vitest';
import {
  generateFlashcards,
  parseFlashcardsResponse,
  InvalidSourceTextError,
  GenerationError,
  MIN_SOURCE_LENGTH,
  MAX_SOURCE_LENGTH,
} from './flashcardGenerator.js';

const CARDS = [{ front: 'Q1', back: 'A1' }];
const VALID_TEXT = 'x'.repeat(MIN_SOURCE_LENGTH + 10);

function okResponse(body) {
  return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('parseFlashcardsResponse', () => {
  it('parses a raw JSON array string', () => {
    expect(parseFlashcardsResponse(JSON.stringify(CARDS))).toEqual(CARDS);
  });

  it('unwraps the {text} and {response} envelopes', () => {
    expect(parseFlashcardsResponse({ text: JSON.stringify(CARDS) })).toEqual(CARDS);
    expect(parseFlashcardsResponse({ response: JSON.stringify(CARDS) })).toEqual(CARDS);
  });

  it('strips markdown fences the model was told not to use', () => {
    expect(parseFlashcardsResponse('```json\n[{"front":"Q1","back":"A1"}]\n```')).toEqual(CARDS);
  });

  it('ignores prose before and after the array', () => {
    const wrapped = `Here is the JSON you asked for:\n${JSON.stringify(CARDS)}\nHope that helps!`;
    expect(parseFlashcardsResponse(wrapped)).toEqual(CARDS);
  });

  it('drops malformed cards but keeps usable ones', () => {
    const mixed = [
      { front: 'Q1', back: 'A1' },
      { front: '', back: 'no question' },
      { front: 'no answer', back: '   ' },
      { front: 42, back: 'wrong type' },
      null,
    ];
    expect(parseFlashcardsResponse(JSON.stringify(mixed))).toEqual(CARDS);
  });

  it('throws when nothing usable survives filtering', () => {
    expect(() => parseFlashcardsResponse(JSON.stringify([{ front: '', back: '' }]))).toThrow(
      GenerationError
    );
  });

  it('throws on a JSON object rather than an array', () => {
    expect(() => parseFlashcardsResponse('{"front":"Q","back":"A"}')).toThrow(GenerationError);
  });

  it('throws on unparseable output instead of returning junk', () => {
    expect(() => parseFlashcardsResponse('I cannot help with that.')).toThrow(GenerationError);
  });

  it('throws when the envelope contains no text at all', () => {
    expect(() => parseFlashcardsResponse({ unexpected: true })).toThrow(GenerationError);
  });
});

describe('generateFlashcards input validation', () => {
  const deps = { supabaseUrl: 'https://x.supabase.co', serviceRoleKey: 'k', fetchImpl: vi.fn() };

  it.each([['', 'empty'], ['   ', 'whitespace'], [null, 'null'], [undefined, 'undefined']])(
    'rejects %s input (%s)',
    async (input) => {
      await expect(generateFlashcards(input, deps)).rejects.toThrow(InvalidSourceTextError);
    }
  );

  it('rejects input too short to make flashcards from', async () => {
    // The reviewer submitted a single character and got a graded quiz asking
    // "What character was provided in the source text?".
    await expect(generateFlashcards('a', deps)).rejects.toThrow(InvalidSourceTextError);
  });

  it('never calls the AI service for rejected input', async () => {
    const fetchImpl = vi.fn();
    await expect(generateFlashcards('a', { ...deps, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts input at exactly the minimum length', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(CARDS)));
    await expect(
      generateFlashcards('x'.repeat(MIN_SOURCE_LENGTH), { ...deps, fetchImpl })
    ).resolves.toEqual(CARDS);
  });
});

describe('generateFlashcards request', () => {
  const base = { supabaseUrl: 'https://x.supabase.co', serviceRoleKey: 'secret-key' };

  it('truncates oversized input rather than rejecting it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(CARDS)));
    await generateFlashcards('y'.repeat(MAX_SOURCE_LENGTH + 5000), { ...base, fetchImpl });

    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.prompt).toContain('y'.repeat(100));
    expect(sent.prompt.length).toBeLessThan(MAX_SOURCE_LENGTH + 500);
  });

  it('calls the gemini-chat Edge Function with the service key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(CARDS)));
    await generateFlashcards(VALID_TEXT, { ...base, fetchImpl });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://x.supabase.co/functions/v1/gemini-chat');
    expect(options.headers.Authorization).toBe('Bearer secret-key');
  });

  it('reports a non-ok response as a generation failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream boom',
    });

    await expect(generateFlashcards(VALID_TEXT, { ...base, fetchImpl })).rejects.toThrow(
      GenerationError
    );
  });

  it('does not leak upstream error detail to the caller', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'secret-key leaked in upstream trace',
    });

    await expect(generateFlashcards(VALID_TEXT, { ...base, fetchImpl })).rejects.toThrow(
      /^AI service returned 500$/
    );
  });

  it('surfaces a network failure as a generation error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(generateFlashcards(VALID_TEXT, { ...base, fetchImpl })).rejects.toThrow(
      GenerationError
    );
  });
});
