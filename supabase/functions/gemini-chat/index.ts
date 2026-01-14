// Deno is available globally in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Standard Supabase CORS headers - Allow backend to call this function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Free user daily limit
const FREE_USER_LIMIT = 5

Deno.serve(async (req) => {
  console.log('=== Edge Function Started ===')
  console.log('Request Method:', req.method)
  console.log('Request URL:', req.url)

  // 1. Handle CORS Preflight - MUST be at the very top
  if (req.method === 'OPTIONS') {
    console.log('CORS Preflight request - returning OK')
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('Request Received - Processing...')

    // 2. Verify Authorization Header and Initialize Supabase Client
    const authHeader = req.headers.get('Authorization')
    console.log('Authorization header present:', !!authHeader)
    
    if (!authHeader) {
      console.error('Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body first (needed for userId if using Service Role Key)
    console.log('Parsing request body...')
    let requestBody
    try {
      requestBody = await req.json()
      console.log('Payload Parsed:', { 
        hasPrompt: !!requestBody.prompt,
        hasUserId: !!requestBody.userId,
        model: requestBody.model || 'default',
        temperature: requestBody.temperature,
        maxTokens: requestBody.maxTokens,
      })
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Extract JWT token from Authorization header (Bearer <token>)
    const token = authHeader.replace('Bearer ', '')
    
    // Initialize Supabase client
    // SUPABASE_URL and SUPABASE_ANON_KEY are automatically available in Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Determine authentication method: Service Role Key (server.js) vs User JWT (frontend)
    let userId: string | null = null
    let isServiceRoleKey = false

    // Check if token is Service Role Key (starts with 'eyJ' but matches service key pattern)
    // Service Role Key is longer and has specific structure
    if (supabaseServiceKey && token === supabaseServiceKey) {
      // Request is from server.js using Service Role Key
      isServiceRoleKey = true
      console.log('Authenticated as Service Role Key (backend request)')
      
      // Extract userId from request body (server.js must pass it)
      userId = requestBody.userId || null
      
      if (!userId) {
        console.error('Service Role Key request missing userId in body')
        return new Response(
          JSON.stringify({ error: 'User ID is required when using Service Role Key' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
      console.log('User ID from request body:', userId)
    } else {
      // Request is from frontend using User JWT token
      console.log('Authenticating as User JWT (frontend request)')
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader },
        },
      })

      // Get authenticated user from JWT token
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      
      if (userError || !user) {
        console.error('Authentication error:', userError)
        return new Response(
          JSON.stringify({ error: 'Invalid or expired authentication token' }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      userId = user.id
      console.log('User authenticated:', userId)
    }

    if (!userId) {
      console.error('Failed to determine user ID')
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate user' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 3. Initialize Supabase client for database queries
    // Use Service Role Key if this is a backend request, otherwise use anon key with user JWT
    const supabaseClient = isServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: { Authorization: authHeader },
          },
        })

    // 4. Query profiles table using user's ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_pro, ai_usage_count')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error querying profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve user profile' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const isPro = profile?.is_pro === true
    const aiUsageCount = profile?.ai_usage_count || 0

    console.log('User profile:', { isPro, aiUsageCount })

    // 4. Check AI usage limits for free users
    if (!isPro) {
      if (aiUsageCount >= FREE_USER_LIMIT) {
        console.log(`Free user limit exceeded: ${aiUsageCount}/${FREE_USER_LIMIT}`)
        return new Response(
          JSON.stringify({ 
            error: `Daily AI limit reached (${FREE_USER_LIMIT}/${FREE_USER_LIMIT}). Upgrade to Pro for unlimited AI.`
          }),
          { 
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      console.log(`Free user usage: ${aiUsageCount}/${FREE_USER_LIMIT}`)
    } else {
      console.log('Pro user - unlimited AI access')
    }

    // 6. Extract prompt and options from request body (already parsed above)
    const { 
      prompt, 
      model = 'gemini-1.5-flash', 
      temperature = 0.7, 
      maxTokens = 2048, 
      format = 'text' 
    } = requestBody
    
    if (!prompt) {
      console.error('Missing prompt in request body')
      return new Response(
        JSON.stringify({ error: 'Missing prompt in request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 7. Get API Key from Environment
    console.log('Retrieving API key from environment...')
    const apiKey = Deno.env.get('gemini_key')
    if (!apiKey) {
      console.error('gemini_key is missing in Supabase Secrets')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing API Key' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    console.log('API key retrieved (length):', apiKey.length)

    // 8. Call Google Gemini API using fetch
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    console.log('Calling Gemini API...', { model, temperature, maxTokens, format })
    
    const geminiRequest = {
      contents: [{ 
        parts: [{ text: prompt }] 
      }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: format === 'json' ? 'application/json' : undefined,
      },
    }

    console.log('Gemini request payload:', JSON.stringify(geminiRequest).substring(0, 200) + '...')

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequest),
    })

    console.log('Gemini API Response Status:', response.status, response.statusText)

    if (!response.ok) {
      let errData
      try {
        errData = await response.json()
      } catch {
        errData = { error: { message: await response.text() } }
      }
      console.error('Gemini API Error:', errData)
      return new Response(
        JSON.stringify({ error: `Gemini API Error: ${errData.error?.message || 'Unknown error'}` }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()
    console.log('Gemini API Response received')
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated"
    console.log('Generated text length:', generatedText.length)

    // 9. Success Response
    console.log('=== Edge Function Completed Successfully ===')
    return new Response(
      JSON.stringify({ text: generatedText }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    // Catch-all error handler
    console.error('=== Edge Function Error ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    
    // Return error with CORS headers so the backend sees the real error
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
