import { supabase } from '../lib/supabaseClient';

/**
 * BASE GEMINI FUNCTION
 * Handles Auth, URL construction, and the raw fetch call.
 */
export async function generateWithGemini(prompt, options = {}) {
  // 1. Setup URLs
  const projectUrl = supabase.supabaseUrl; 
  const baseUrl = projectUrl.endsWith('/') ? projectUrl.slice(0, -1) : projectUrl;
  const functionUrl = `${baseUrl}/functions/v1/gemini-chat`;
  
  // 2. Get Token (Direct from Storage)
  const projectId = projectUrl.split('//')[1].split('.')[0];
  let token = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const rawSession = localStorage.getItem(`sb-${projectId}-auth-token`);
  
  if (rawSession) {
      try {
          const session = JSON.parse(rawSession);
          if (session.access_token) token = session.access_token;
      } catch (e) { /* ignore */ }
  }

  // 3. Send Request
  // We use 'gemini-1.5-flash' here as it is the standard stable version.
  console.log(`🚀 Sending Request to Gemini (${options.model || 'gemini-1.5-flash'})...`);
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt: prompt,
      // If you specifically need 'gemini-flash-latest', change it here:
      model: options.model || 'gemini-flash-latest', 
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 2048 // Default limit
    })
  });

  const textData = await response.text();
  let data;
  try {
    data = JSON.parse(textData);
  } catch (e) {
    throw new Error(`Server returned non-JSON: ${textData.substring(0, 50)}...`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}`);
  }

  return data.text;
}

/**
 * HELPER: Robust JSON Extractor
 * Finds the first valid { or [ and extracts the matching block.
 */
function extractJSONFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // Remove Markdown
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // Find start
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  
  let startIndex = -1;
  let isArray = false;

  if (firstBrace === -1 && firstBracket === -1) return null;

  if (firstBrace === -1) { startIndex = firstBracket; isArray = true; }
  else if (firstBracket === -1) { startIndex = firstBrace; isArray = false; }
  else {
    startIndex = Math.min(firstBrace, firstBracket);
    isArray = startIndex === firstBracket;
  }

  // Find end (simple last index search is safer for AI output)
  const closeChar = isArray ? ']' : '}';
  const endIndex = cleaned.lastIndexOf(closeChar);

  if (endIndex === -1 || endIndex < startIndex) return null;

  return cleaned.substring(startIndex, endIndex + 1);
}

/**
 * GENERIC JSON GENERATOR
 * Use this for Analysis, Summaries, etc.
 */
export async function generateJSONWithGemini(prompt, options = {}) {
  const text = await generateWithGemini(prompt, options);
  try {
    const cleanJson = extractJSONFromText(text);
    if (!cleanJson) throw new Error("No JSON found in response");
    return JSON.parse(cleanJson);
  } catch (parseError) {
    console.error("🔥 JSON Parse Error:", parseError);
    console.error("Raw Text:", text);
    throw new Error('AI response was not valid JSON.');
  }
}

/**
 * DEDICATED FLASHCARD GENERATOR
 * Enforces Array format [...] and handles large responses.
 */
export async function generateFlashcardSet(prompt, options = {}) {
  console.log("⚡ Generating Flashcard Set (High Capacity Mode)...");

  // 1. Strict Prompting
  const strictPrompt = `
    ${prompt}
    
    IMPORTANT: Return ONLY a raw JSON Array. 
    Structure: [{"front": "Question", "back": "Answer"}, ...]
    Do not add any conversational text.
  `;

  // 2. High Token Limit (Prevents cutoff error "Unclosed JSON")
  const rawText = await generateWithGemini(strictPrompt, { 
    ...options,
    model: 'gemini-flash-latest', // Ensure we use the fast/cheap model
    maxTokens: 8192 // 4x normal limit to ensure closing bracket ]
  });

  try {
    // 3. Extract & Parse
    const cleanJson = extractJSONFromText(rawText);
    if (!cleanJson) throw new Error("No JSON structure found.");
    
    const parsedData = JSON.parse(cleanJson);

    // 4. Validate Array
    if (Array.isArray(parsedData)) return parsedData;
    
    // If it wrapped it in { "flashcards": [...] }, unwrap it
    if (typeof parsedData === 'object') {
      const arrayVal = Object.values(parsedData).find(val => Array.isArray(val));
      if (arrayVal) return arrayVal;
    }

    throw new Error("Response was valid JSON but not an Array.");

  } catch (error) {
    console.error("🔥 Flashcard Error:", error);
    throw new Error(`Failed to generate flashcards: ${error.message}`);
  }
}