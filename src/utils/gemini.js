/**
 * Gemini AI API Client
 * 
 * Handles all Gemini API calls via Supabase Edge Function proxy.
 * API keys are stored securely in the Edge Function, not in the frontend.
 * 
 * Uses: supabase.functions.invoke('generate-flashcards', ...)
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Generate text using Gemini API via Supabase Edge Function
 * @param {string} prompt - The prompt to send to Gemini
 * @param {Object} options - Additional options
 * @returns {Promise<string>} The generated response
 */
export async function generateWithGemini(prompt, options = {}) {
  const {
    model = 'gemini-pro',
    temperature = 0.7,
    maxTokens = 2048,
    format = 'text', // 'text' or 'json'
  } = options;

  try {
    // Call Supabase Edge Function (automatically includes user's JWT token)
    const { data, error } = await supabase.functions.invoke('generate-flashcards', {
      body: {
        prompt,
        model,
        temperature,
        maxTokens,
        format,
      },
    });

    if (error) {
      console.error('Gemini Edge Function error:', error);
      throw new Error(`AI service error: ${error.message || 'Failed to generate response'}`);
    }

    if (!data || !data.text) {
      throw new Error('No response text from AI service');
    }

    return data.text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

/**
 * Generate JSON response using Gemini via Supabase Edge Function
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function generateJSONWithGemini(prompt, options = {}) {
  const text = await generateWithGemini(prompt, { ...options, format: 'json' });
  
  try {
    // Try to parse JSON (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (parseError) {
    console.error('Failed to parse AI JSON response:', parseError);
    console.error('Response text:', text);
    throw new Error('Failed to parse AI response as JSON');
  }
}
