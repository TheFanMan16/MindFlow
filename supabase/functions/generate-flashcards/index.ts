// Deno is available globally in Supabase Edge Functions
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight (The Browser Check)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Validate Body
    const { prompt } = await req.json()
    if (!prompt) {
      throw new Error('Missing prompt in request body')
    }

    // 3. Check API Key
    const apiKey = Deno.env.get('gemini_key')
    if (!apiKey) {
      console.error('gemini_key is missing in Supabase Secrets')
      throw new Error('Server configuration error: Missing API Key')
    }

    // 4. Call Google Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )

    if (!response.ok) {
      const errData = await response.json()
      console.error('Gemini API Error:', errData)
      throw new Error(`Gemini API Error: ${errData.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated"

    // 5. Success Response
    return new Response(JSON.stringify({ text: generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge Function Error:', error.message)
    // Return error with CORS headers so the browser sees the real error
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})