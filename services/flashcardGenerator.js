/**
 * Flashcard Generation
 *
 * Turns source text into flashcards via the Gemini Edge Function. Extracted
 * from the /api/generate-from-pdf handler so the PDF and pasted-text routes
 * share one implementation rather than two drifting copies.
 */

// Roughly 3-4k tokens. Longer input is truncated rather than rejected.
const MAX_SOURCE_LENGTH = 15000;

// Below this there is nothing to make flashcards from, and calling the model
// wastes a user's daily quota to produce nonsense. The reviewer who submitted
// a single character got a graded quiz asking "What character was provided?".
const MIN_SOURCE_LENGTH = 100;

/** Raised when the caller's input cannot produce flashcards. Maps to HTTP 400. */
class InvalidSourceTextError extends Error {}

/** Raised when generation itself fails. Maps to HTTP 500. */
class GenerationError extends Error {}

function buildPrompt(sourceText) {
  return `You are a strict exam prep tool. Extract 15 key concepts from the text.

Return ONLY a raw JSON Array. Do not use Markdown blocks. Do not say "Here is the JSON".

The JSON must follow this exact schema: [{ "front": "Question...", "back": "Answer..." }].

Keep definitions concise (under 20 words each). Do not include examples unless necessary.

Text:
${sourceText}`;
}

/**
 * Extracts a flashcard array from whatever shape the Edge Function returned.
 * The model is asked for raw JSON but frequently wraps it in markdown or
 * prose, so this is deliberately forgiving about the envelope and strict
 * about the contents.
 *
 * @param {unknown} data - parsed Edge Function response
 * @returns {Array<{front: string, back: string}>}
 * @throws {GenerationError}
 */
function parseFlashcardsResponse(data) {
  let responseText = data;
  if (typeof data !== 'string') {
    responseText = data?.text ?? data?.response ?? data;
  }

  if (typeof responseText !== 'string') {
    throw new GenerationError('AI response did not contain any text');
  }

  let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

  // Ignore any preamble before the array and any trailing commentary.
  const firstBracket = cleanJson.indexOf('[');
  const lastBracket = cleanJson.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    throw new GenerationError(`AI did not return valid JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new GenerationError('AI response was not a list of flashcards');
  }

  const flashcards = parsed.filter(
    (card) =>
      card &&
      typeof card.front === 'string' &&
      typeof card.back === 'string' &&
      card.front.trim().length > 0 &&
      card.back.trim().length > 0
  );

  if (flashcards.length === 0) {
    throw new GenerationError('AI response contained no usable flashcards');
  }

  return flashcards;
}

/**
 * Generates flashcards from source text.
 *
 * @param {string} sourceText
 * @param {{supabaseUrl: string, serviceRoleKey: string, fetchImpl?: Function}} deps
 * @returns {Promise<Array<{front: string, back: string}>>}
 * @throws {InvalidSourceTextError|GenerationError}
 */
async function generateFlashcards(sourceText, { supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  if (typeof sourceText !== 'string' || sourceText.trim().length === 0) {
    throw new InvalidSourceTextError('No text provided');
  }

  const trimmed = sourceText.trim();

  if (trimmed.length < MIN_SOURCE_LENGTH) {
    throw new InvalidSourceTextError(
      `Need at least ${MIN_SOURCE_LENGTH} characters to make flashcards from - got ${trimmed.length}.`
    );
  }

  const cleanText = trimmed.slice(0, MAX_SOURCE_LENGTH);

  let response;
  try {
    response = await fetchImpl(`${supabaseUrl}/functions/v1/gemini-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        prompt: buildPrompt(cleanText),
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 8192,
      }),
    });
  } catch (err) {
    throw new GenerationError(`Could not reach the AI service: ${err.message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Edge Function error:', response.status, detail.slice(0, 500));
    throw new GenerationError(`AI service returned ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new GenerationError('AI service returned a malformed response');
  }

  return parseFlashcardsResponse(data);
}

module.exports = {
  generateFlashcards,
  parseFlashcardsResponse,
  InvalidSourceTextError,
  GenerationError,
  MIN_SOURCE_LENGTH,
  MAX_SOURCE_LENGTH,
};
