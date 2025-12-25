/**
 * Backend API Proxy (For Production)
 * 
 * ⚠️ IMPORTANT: This is a template for a backend API you should create.
 * 
 * Instead of calling Gemini/Stripe directly from the client,
 * call YOUR backend API, which then calls the external APIs.
 * 
 * This keeps API keys secure on the server.
 * 
 * Example backend implementation (Node.js/Express):
 * 
 * ```javascript
 * // backend/routes/ai.js
 * const express = require('express');
 * const router = express.Router();
 * 
 * router.post('/generate', async (req, res) => {
 *   const { prompt, options } = req.body;
 *   
 *   // Rate limiting check
 *   if (!await checkRateLimit(req.user.id)) {
 *     return res.status(429).json({ error: 'Rate limit exceeded' });
 *   }
 *   
 *   // Call Gemini from server (key stored in server .env)
 *   const response = await fetch(
 *     `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
 *     {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({
 *         contents: [{ parts: [{ text: prompt }] }],
 *         generationConfig: options,
 *       }),
 *     }
 *   );
 *   
 *   const data = await response.json();
 *   res.json(data);
 * });
 * ```
 * 
 * Then in your React app, call:
 * ```javascript
 * const response = await fetch('/api/generate', {
 *   method: 'POST',
 *   body: JSON.stringify({ prompt, options }),
 * });
 * ```
 */

import config from '../config/api';

/**
 * Call backend API proxy instead of direct API
 * This function should be used in production
 */
export async function callBackendProxy(endpoint, data) {
  // In production, this would call YOUR backend API
  // which has the API keys stored securely on the server
  
  if (config.isDevelopment) {
    console.warn('Using direct API calls. For production, use backend proxy.');
    throw new Error('Backend proxy not configured. Use direct API calls in development only.');
  }

  try {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if needed
        // 'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Backend proxy error:', error);
    throw error;
  }
}

/**
 * Check if backend proxy is available
 */
export function isBackendProxyAvailable() {
  // In production, check if backend API is configured
  return config.env === 'production' && !config.isDevelopment;
}

