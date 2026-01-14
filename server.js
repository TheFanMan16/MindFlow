// CRITICAL: Load environment variables FIRST, before any other imports
require('dotenv').config();

// Debug logging setup
const fs = require('fs');
const path = require('path');
const logDir = path.join(__dirname, '.cursor');
const logPath = path.join(logDir, 'debug.log');
const logEntry = (data) => {
  try {
    // Ensure directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const entry = JSON.stringify(data) + '\n';
    fs.appendFileSync(logPath, entry, 'utf8');
  } catch (e) {
    // Log to console if file write fails
    console.error('Debug log write failed:', e.message);
  }
};

// CRITICAL: FAIL-HARD VALIDATION - Must run BEFORE any other code
// This ensures the server fails to start if required environment variables are missing
// Check environment mode
const isProduction = process.env.NODE_ENV === 'production';

// List of required environment variables for the server (always required)
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_ID',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Note: STRIPE_WEBHOOK_SECRET is only required in production (webhooks)
  // Note: SUPABASE_URL can be VITE_SUPABASE_URL or SUPABASE_URL (checked separately)
];

// Check each required variable individually and fail immediately if missing
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    const errorMessage = `FATAL: Missing required environment variable ${varName}.`;
    console.error('='.repeat(80));
    console.error(errorMessage);
    console.error('='.repeat(80));
    console.error(`\nThe server cannot start without ${varName}.`);
    console.error(`Please set ${varName} in your .env file.`);
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// STRIPE_WEBHOOK_SECRET is only required in production (for webhook endpoints)
// In development, webhooks are typically not needed or handled via Stripe CLI
if (isProduction && !process.env.STRIPE_WEBHOOK_SECRET) {
  const errorMessage = 'FATAL: Missing required environment variable STRIPE_WEBHOOK_SECRET.';
  console.error('='.repeat(80));
  console.error(errorMessage);
  console.error('='.repeat(80));
  console.error('\nThe server cannot start in production without STRIPE_WEBHOOK_SECRET.');
  console.error('Please set STRIPE_WEBHOOK_SECRET in your .env file.');
  console.error('='.repeat(80));
  process.exit(1);
}

// Warn in development if STRIPE_WEBHOOK_SECRET is missing (but don't fail)
if (!isProduction && !process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️  STRIPE_WEBHOOK_SECRET is not set. Webhook endpoints will not work.');
  console.warn('   This is OK for development, but required for production.');
}

// Check Supabase URL (can be either VITE_SUPABASE_URL or SUPABASE_URL)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
if (!supabaseUrl) {
  const errorMessage = 'FATAL: Missing required environment variable SUPABASE_URL (or VITE_SUPABASE_URL).';
  console.error('='.repeat(80));
  console.error(errorMessage);
  console.error('='.repeat(80));
  console.error('\nThe server cannot start without Supabase URL.');
  console.error('Please set VITE_SUPABASE_URL or SUPABASE_URL in your .env file.');
  console.error('='.repeat(80));
  process.exit(1);
}

// Debug: Verify environment variables are loaded (only in development)
if (process.env.NODE_ENV === 'development') {
console.log('🔍 Environment Check:');
console.log('  - VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL.substring(0, 5)}...` : 'NOT SET');
console.log('  - SUPABASE_URL:', process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 5)}...` : 'NOT SET');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : 'NOT SET');
  console.log('  - STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ SET' : 'NOT SET');
  console.log('  - STRIPE_PRICE_ID:', process.env.STRIPE_PRICE_ID ? '✅ SET' : 'NOT SET');
  console.log('  - STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✅ SET' : 'NOT SET');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const pdfParseLib = require('pdf-parse');
// pdf-parse v2.4.5 exports PDFParse as a class constructor
const PDFParse = pdfParseLib.PDFParse;
const { createClient } = require('@supabase/supabase-js');
const app = express();

// Configure Multer for PDF file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Initialize Supabase client for database access
// CRITICAL: Variables are guaranteed to exist due to fail-hard validation above
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Supabase Admin client for Edge Function calls (requires service role key)
// CRITICAL: Reuse the same variables from above (already validated)
// Both supabaseUrl and supabaseServiceKey are guaranteed to exist due to process.exit(1) checks above
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
});

if (process.env.NODE_ENV === 'development') {
  console.log('✅ Supabase Admin client initialized for Edge Function calls');
}

// CRITICAL: Middleware MUST be placed immediately after app initialization, before routes

// Security Headers: Helmet for secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable if it causes issues with external resources
}));

// CORS Configuration: Restrict to allowed origins only
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  // Add your production domain here when ready
  // 'https://your-production-domain.com',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting: General limit for all routes (100 requests per 15 minutes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for webhooks and other internal routes
  skip: (req) => {
    // Skip rate limiting for Stripe webhooks (they come from Stripe's IPs)
    return req.path === '/webhook';
  },
});

// Rate Limiting: Stricter limit for PDF/AI processing endpoints (10 requests per hour)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  message: {
    error: 'Too many AI/PDF processing requests. Please try again later. (Limit: 10 requests per hour)',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Apply stricter rate limiting to AI/PDF processing endpoints
app.use('/api/generate-from-pdf', aiLimiter);
app.use('/api/analyze-feynman', aiLimiter);

// Stripe Webhook Handler - MUST be BEFORE express.json() middleware
// Stripe webhooks require raw body data for signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // In development, webhook secret may be optional (but warn if missing)
  if (!webhookSecret) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET is not set. Webhook endpoint is disabled.');
    return res.status(500).json({ error: 'Webhook secret not configured. Set STRIPE_WEBHOOK_SECRET in your .env file.' });
  }

  let event;

  try {
    // Verify the webhook signature using Stripe's constructEvent
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ Webhook signature verified');
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Switch on event.type to handle different Stripe events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      
      // Extract session.client_reference_id (this is the User ID)
      const userId = session.client_reference_id;
      
      // Extract session.customer (this is the Stripe Customer ID)
      const stripeCustomerId = session.customer;

      if (!userId) {
        console.error('❌ ERROR: No client_reference_id (userId) in session');
        return res.status(400).json({ error: 'No user ID in session' });
      }

      if (!stripeCustomerId) {
        console.error('❌ ERROR: No customer ID in session');
        return res.status(400).json({ error: 'No customer ID in session' });
      }

      if (!supabase) {
        console.error('❌ ERROR: Supabase client not initialized');
        return res.status(500).json({ error: 'Database not initialized' });
      }

      try {
        // Calculate pro_expires_at
        // Use session.expires_at if available, otherwise calculate 1 month from now
        let proExpiresAt;
        if (session.expires_at) {
          proExpiresAt = new Date(session.expires_at * 1000).toISOString();
        } else {
          // Calculate 1 month from now
          const oneMonthFromNow = new Date();
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          proExpiresAt = oneMonthFromNow.toISOString();
        }

        // On Success: Update profiles table
        // Set is_pro = true
        // Set stripe_customer_id = session.customer
        // Set pro_expires_at
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            is_pro: true,
            stripe_customer_id: stripeCustomerId,
            pro_expires_at: proExpiresAt
          })
          .eq('id', userId);

        if (updateError) {
          console.error('❌ ERROR updating profiles table:', updateError);
          return res.status(500).json({ error: 'Failed to update profile' });
        }

        console.log(`✅ Success: User ${userId} upgraded to Pro, linked to Customer ${stripeCustomerId}, expires at ${proExpiresAt}`);
      } catch (error) {
        console.error('❌ ERROR processing webhook event:', error);
        return res.status(500).json({ error: error.message });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      if (!stripeCustomerId) {
        console.error('❌ ERROR: No customer ID in subscription');
        return res.status(400).json({ error: 'No customer ID in subscription' });
      }

      if (!supabase) {
        console.error('❌ ERROR: Supabase client not initialized');
        return res.status(500).json({ error: 'Database not initialized' });
      }

      try {
        // Refactor Cancellation: Set is_pro = false and pro_expires_at = null
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            is_pro: false,
            pro_expires_at: null
          })
          .eq('stripe_customer_id', stripeCustomerId);

        if (updateError) {
          console.error('❌ ERROR updating profiles table for cancellation:', updateError);
          return res.status(500).json({ error: 'Failed to update profile' });
        }

        console.log(`✅ Success: Subscription cancelled for Customer ${stripeCustomerId}, is_pro set to false`);
      } catch (error) {
        console.error('❌ ERROR processing cancellation webhook:', error);
        return res.status(500).json({ error: error.message });
      }
      break;
    }
    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

// Apply express.json() middleware AFTER webhook route (so webhook gets raw body)
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
  if (req.path === '/get-subscription-details' || req.url === '/get-subscription-details') {
    // #region agent log
    console.log('🔍 DEBUG: Middleware caught request for /get-subscription-details', req.method, req.path, req.url);
    logEntry({location:'server.js:137',message:'Request received for get-subscription-details',data:{method:req.method,path:req.path,url:req.url,originalUrl:req.originalUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'});
    // #endregion
  }
  next();
});

// Get Stripe secret key from environment variable (TEST key expected: sk_test_...)
// CRITICAL: Variable is guaranteed to exist due to fail-hard validation above
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;


const stripe = require('stripe')(stripeSecretKey);
if (process.env.NODE_ENV === 'development') {
console.log('✅ Stripe initialized with TEST key (sk_test_...)');
}

// Log Supabase initialization status (only in development)
if (supabase) {
  if (process.env.NODE_ENV === 'development') {
  console.log('✅ Supabase client initialized successfully');
  console.log('  - URL:', supabaseUrl.substring(0, 20) + '...');
  }
} else {
  console.error('❌ ERROR: Supabase client NOT initialized.');
  console.error('  - Missing VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('  - Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('  - Check your .env file in the project root directory');
}

// Helper function: Check and increment AI usage limit
// Returns { allowed: true } if user can use AI, { allowed: false, message: '...' } if limit reached
// Helper function to check and increment PDF flashcard generation limit (monthly)
async function checkAndIncrementPDFLimit(userId) {
  if (!supabase) {
    console.error('❌ Supabase client not initialized in checkAndIncrementPDFLimit');
    return { allowed: false, message: 'Server error: Database not available.' };
  }

  const FREE_PDF_LIMIT = 3;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  try {
    // First, check if user is Pro (Pro users bypass the limit)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Error fetching profile for PDF limit:', profileError?.message || 'Profile not found');
      return { allowed: false, message: 'User profile not found.' };
    }

    // Pro Bypass: If is_pro is true, allow immediately
    if (profile.is_pro === true) {
      return { allowed: true, currentUsage: -1, limit: -1 }; // -1 indicates unlimited
    }

    // Query user_usage table for current month's count
    // First, try to get any record for this user (to check for month changes)
    const { data: allUsage, error: allUsageError } = await supabase
      .from('user_usage')
      .select('flashcard_generations_count, month')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    let currentCount = 0;
    let needsInsert = false;

    if (allUsageError && allUsageError.code !== 'PGRST116') {
      console.error('❌ Error querying user_usage:', allUsageError);
      return { allowed: false, message: 'Error checking usage limits.' };
    }

    // If no record exists, or record is for a different month, reset
    if (!allUsage || allUsage.month !== currentMonth) {
      currentCount = 0;
      needsInsert = !allUsage; // Insert if no record, update if different month
      
      if (needsInsert) {
        // Create new record for current month
        const { error: insertError } = await supabase
          .from('user_usage')
          .insert({
            user_id: userId,
            month: currentMonth,
            flashcard_generations_count: 0,
          });

        if (insertError) {
          console.error('❌ Error creating user_usage record:', insertError);
          return { allowed: false, message: 'Error initializing usage tracking.' };
        }
      } else {
        // Update existing record to new month
        const { error: updateError } = await supabase
          .from('user_usage')
          .update({ 
            month: currentMonth,
            flashcard_generations_count: 0 
          })
          .eq('user_id', userId)
          .eq('month', allUsage.month);

        if (updateError) {
          console.error('❌ Error updating month in user_usage:', updateError);
        }
      }
    } else {
      // Record exists for current month, use existing count
      currentCount = allUsage.flashcard_generations_count || 0;
    }

    // Limit Check: If count >= 3, deny
    if (currentCount >= FREE_PDF_LIMIT) {
      return { 
        allowed: false, 
        message: 'Free limit reached. Upgrade to Pro.',
        currentUsage: currentCount,
        limit: FREE_PDF_LIMIT
      };
    }

    // Increment: Update the count (record should exist now)
    const { error: incrementError } = await supabase
      .from('user_usage')
      .update({ flashcard_generations_count: currentCount + 1 })
      .eq('user_id', userId)
      .eq('month', currentMonth);

    if (incrementError) {
      console.error('❌ Error incrementing PDF usage:', incrementError);
      // Still allow the request, but log the error
      // Note: This means the count won't be tracked, but we don't want to block the user
    }

    return { 
      allowed: true, 
      currentUsage: currentCount + 1, 
      limit: FREE_PDF_LIMIT 
    };
  } catch (error) {
    console.error('❌ Unexpected error in checkAndIncrementPDFLimit:', error);
    return { allowed: false, message: 'An unexpected server error occurred.' };
  }
}

async function checkAndIncrementAILimit(userId) {
  if (!supabase) {
    throw new Error('Database not initialized');
  }

  // Fetch the user's is_pro, ai_usage_count, and last_usage_date from the profiles table
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('is_pro, ai_usage_count, last_usage_date')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ Error querying user for AI limit:', userError);
    throw new Error('Failed to query user data');
  }

  // Pro Bypass: If is_pro is true, allow immediately
  if (user?.is_pro === true) {
    return { allowed: true };
  }

  // Date Check: Get today's date (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  let currentCount = user?.ai_usage_count || 0;
  let lastUsageDate = user?.last_usage_date;

  // If last_usage_date does NOT match today (or is null): Reset ai_usage_count to 0
  if (lastUsageDate !== today) {
    currentCount = 0;
    lastUsageDate = today;
    
    // Update last_usage_date to today (reset count will be done in increment step)
    const { error: resetError } = await supabase
      .from('profiles')
      .update({ 
        ai_usage_count: 0,
        last_usage_date: today
      })
      .eq('id', userId);
    
    if (resetError) {
      console.error('❌ Error resetting AI usage count:', resetError);
      // Continue anyway
    }
  }

  // Limit Check: If ai_usage_count >= 5, return { allowed: false, message: 'Daily limit reached' }
  if (currentCount >= 5) {
    return { 
      allowed: false, 
      message: 'Daily AI Limit Reached (5/5). Upgrade to Pro for unlimited.' 
    };
  }

  // Increment: If allowed, increment ai_usage_count by 1 in the database
  const newCount = currentCount + 1;
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      ai_usage_count: newCount,
      last_usage_date: today
    })
    .eq('id', userId);

  if (updateError) {
    console.error('❌ Error incrementing AI usage count:', updateError);
    // Continue anyway - we'll allow the request
  }

  // Return { allowed: true }
  return { allowed: true, usageCount: newCount };
}

// Helper function: Chunk text into ~4000 character pieces
function chunkText(text, chunkSize = 4000) {
  const chunks = [];
  let currentIndex = 0;
  
  while (currentIndex < text.length) {
    const chunk = text.substring(currentIndex, currentIndex + chunkSize);
    chunks.push(chunk);
    currentIndex += chunkSize;
  }
  
  return chunks;
}

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { userId, email, priceId: requestPriceId } = req.body;
    
    // Validate userId is provided
    if (!userId) {
      console.error('❌ Error: userId is missing from request body');
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // 1. Check if user already has a Stripe ID in OUR database
    console.log('🔍 Checking for existing Stripe customer ID for user:', userId);
    let { data: user, error: userError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error querying user:', userError);
      return res.status(500).json({ error: 'Failed to query user data' });
    }

    // Get user email (from request body, or fallback to database)
    const userEmail = email || user?.email;
    if (!userEmail) {
      console.error('❌ User email not found');
      return res.status(400).json({ error: 'User email is required. Cannot create checkout session.' });
    }

    let customerId = user?.stripe_customer_id;

    // 2. IF MISSING: Create the customer in Stripe NOW and save it immediately
    if (!customerId) {
      console.log('📧 Creating new Stripe customer for:', userEmail);
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId: userId } // Tag them in Stripe too
      });
      customerId = newCustomer.id;
      
      // SAVE IMMEDIATELY - Do not wait for webhooks
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
      
      if (updateError) {
        console.error('❌ Error saving customer ID to database:', updateError);
        // Continue anyway - we have the customer ID, just log the error
      } else {
        console.log('✅ Saved new Customer ID:', customerId);
      }
    } else {
      console.log('✅ Reusing existing Stripe customer:', customerId);
    }

    // Get price ID (from request or environment variable)
    // CRITICAL: Variable is guaranteed to exist due to fail-hard validation at startup
    const priceId = requestPriceId || process.env.STRIPE_PRICE_ID;
    
    // VALIDATION: Ensure we're using TEST price ID
    if (!priceId.startsWith('price_1')) {
      console.warn('⚠️ WARNING: Price ID does not start with price_1. Ensure this is a test price ID.');
    }

    // 3. Create Checkout Session using the EXISTING (or new) ID
    // Wrap in try/catch for self-healing logic
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId, // <--- CRITICAL: Use the specific ID
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId, // Use the actual Price ID
            quantity: 1,
          },
        ],
        // CRITICAL: Include userId for webhook identification
        client_reference_id: userId,
        metadata: {
          userId: userId,
        },
        success_url: 'http://localhost:5173/dashboard?success=true',
        cancel_url: 'http://localhost:5173/dashboard?canceled=true',
      });

      console.log('✅ Checkout session created successfully');
      console.log('  - Session ID:', session.id);
      console.log('  - Customer ID:', session.customer);
      console.log('  - client_reference_id:', session.client_reference_id);
    } catch (error) {
      // Catch the Error: Check if it's a missing customer error
      const errorMessage = error.message?.toLowerCase() || '';
      const isMissingCustomer = 
        error.code === 'resource_missing' ||
        errorMessage.includes('no such customer') ||
        (errorMessage.includes('customer') && errorMessage.includes('not found'));

      if (isMissingCustomer) {
        // Log: 'Stripe customer deleted. Creating new one...'
        console.log('⚠️ Stripe customer deleted. Creating new one...');
        console.log('  - Old customer ID:', customerId);
        console.log('  - Error:', error.message);

        // Action: Call stripe.customers.create({ email }) immediately
        const newCustomer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId: userId }
        });
        
        console.log('✅ New Stripe customer created:', newCustomer.id);

        // Update DB: Update the profiles table with the NEW stripe_customer_id
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ stripe_customer_id: newCustomer.id })
          .eq('id', userId);
        
        if (updateError) {
          console.error('❌ Error saving new customer ID to database:', updateError);
          // Continue anyway - we have the customer ID
        } else {
          console.log('✅ New customer ID saved to database:', newCustomer.id);
        }

        // Retry: Retry creating the Checkout Session with this new ID
        customerId = newCustomer.id;
        session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          client_reference_id: userId,
          metadata: {
            userId: userId,
          },
          success_url: 'http://localhost:5173/dashboard?success=true',
          cancel_url: 'http://localhost:5173/dashboard?canceled=true',
        });

        console.log('✅ Checkout session created successfully after self-healing');
        console.log('  - Session ID:', session.id);
        console.log('  - New Customer ID:', session.customer);
        console.log('  - client_reference_id:', session.client_reference_id);
      } else {
        // Fallback: If it's a different error, throw it normally
        throw error;
      }
    }

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Checkout Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-from-pdf', upload.single('pdf'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check PDF flashcard generation limit (monthly, 3 free)
    const pdfLimitCheck = await checkAndIncrementPDFLimit(userId);
    if (!pdfLimitCheck.allowed) {
      return res.status(403).json({ error: pdfLimitCheck.message || 'Free limit reached. Upgrade to Pro.' });
    }

    // Check AI usage limit (daily, 5 free)
    const limitCheck = await checkAndIncrementAILimit(userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: limitCheck.message });
    }

    console.log('📥 PDF to flashcards request received');
    console.log('  - File name:', req.file.originalname);
    console.log('  - File size:', req.file.size, 'bytes');
    console.log('  - User ID:', userId);

    // PDF Parsing: Extract text from PDF buffer
    let pdfText;
    try {
      // Debugging: Check PDFParse type
      console.log('PDFParse type:', typeof PDFParse);
      console.log('PDF Parse Library Keys:', Object.keys(pdfParseLib || {}).slice(0, 10));
      
      // PDFParse is a class, need to instantiate it with 'new'
      const parser = new PDFParse({ data: req.file.buffer });
      const pdfData = await parser.getText();
      pdfText = pdfData.text;
      
      if (!pdfText || pdfText.trim().length === 0) {
        return res.status(400).json({ error: 'PDF appears to be empty or contains no extractable text' });
      }
      
      // Log Length: Log the extracted text length
      console.log('Extracted PDF Text Length:', pdfText.length);
      console.log('✅ PDF parsed successfully, text length:', pdfText.length);
    } catch (parseError) {
      console.error('❌ PDF parsing error:', parseError);
      if (parseError.message && parseError.message.toLowerCase().includes('encrypted')) {
        return res.status(400).json({ error: 'PDF is encrypted and cannot be processed' });
      }
      return res.status(400).json({ error: `Failed to parse PDF: ${parseError.message}` });
    }

    // Truncate/Chunk: Take only the first 15,000 characters (roughly 3-4k tokens)
    const cleanText = pdfText.slice(0, 15000);
    
    console.log('📄 Processing truncated text, length:', cleanText.length);
    if (pdfText.length > 15000) {
      console.log(`⚠️ Text truncated from ${pdfText.length} to ${cleanText.length} characters`);
    }

    // AI Generation: Construct prompt and call Gemini
    const prompt = `You are a strict exam prep tool. Extract 15 key concepts from the text.

Return ONLY a raw JSON Array. Do not use Markdown blocks. Do not say "Here is the JSON".

The JSON must follow this exact schema: [{ "front": "Question...", "back": "Answer..." }].

Keep definitions concise (under 20 words each). Do not include examples unless necessary.

Text:
${cleanText}`;

    // Call Gemini Edge Function via raw fetch with Service Role Key
    // CRITICAL: Use already-validated variables from initialization (guaranteed to exist)
    const supabaseProjectUrl = supabaseUrl;
    const serviceRoleKey = supabaseServiceKey;

    // Construct the URL
    const edgeFunctionUrl = `${supabaseProjectUrl}/functions/v1/gemini-chat`;

    if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Calling Gemini Edge Function for flashcard generation...');
    console.log('  - Prompt length:', prompt.length, 'characters');
    console.log('  - Text length:', cleanText.length, 'characters');
    console.log('Edge Function URL:', edgeFunctionUrl);
    }

    // Make raw fetch request
    let response;
    try {
      response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          maxTokens: 8192,
        }),
      });

      // Error Handling: Check response.ok
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Edge Function error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Edge Function returned ${response.status} ${response.statusText}: ${errorText}`);
      }
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return res.status(500).json({ error: `AI generation failed: ${fetchError.message}` });
    }

    // Parse the response
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      const textResponse = await response.text().catch(() => 'Could not read response');
      console.error('Raw response:', textResponse.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse Edge Function response' });
    }

    // Parse AI response
    let flashcards;
    try {
      // Try to extract JSON from the response (AI might return markdown-wrapped JSON)
      let responseText = data;
      if (typeof data === 'string') {
        responseText = data;
      } else if (data?.text) {
        responseText = data.text;
      } else if (data?.response) {
        responseText = data.response;
      }

      // Strip markdown
      let cleanJson = responseText.trim();
      cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Ensure we start at the first bracket (ignore intro text)
      const firstBracket = cleanJson.indexOf('[');
      const lastBracket = cleanJson.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
      }

      // Safety check: Warn if JSON was truncated
      if (!cleanJson.endsWith(']')) {
        console.warn('⚠️ JSON was truncated - response may be incomplete');
        console.warn('Last 100 chars:', cleanJson.slice(-100));
      }

      flashcards = JSON.parse(cleanJson);

      // Validate the structure
      if (!Array.isArray(flashcards)) {
        throw new Error('Response is not an array');
      }

      // Validate each flashcard has front and back
      flashcards = flashcards.filter(card => 
        card && 
        typeof card.front === 'string' && 
        typeof card.back === 'string' &&
        card.front.trim().length > 0 &&
        card.back.trim().length > 0
      );

      if (flashcards.length === 0) {
        throw new Error('No valid flashcards found in AI response');
      }

      console.log('✅ Successfully generated', flashcards.length, 'flashcards');
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      console.error('Raw response:', typeof data === 'string' ? data.substring(0, 500) : JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: `Failed to parse AI response as JSON: ${parseError.message}. The AI may not have returned valid JSON.` });
    }

    // Return Data: Send flashcards array to frontend
    res.json({ flashcards });
  } catch (error) {
    console.error('❌ PDF to Flashcards Error:', error.message);
    console.error('Error details:', error);
    res.status(500).json({ error: error.message || 'An unexpected error occurred' });
  }
});

app.post('/api/analyze-feynman', async (req, res) => {
  try {
    console.log('📥 Feynman analysis request received');
    console.log('  - Request body:', JSON.stringify(req.body, null, 2));
    
    const { concept, explanation, userId } = req.body;
    
    if (!concept || !explanation) {
      return res.status(400).json({ error: 'Both concept and explanation are required' });
    }

    // Check AI usage limit (requires userId)
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const limitCheck = await checkAndIncrementAILimit(userId);
    if (!limitCheck.allowed) {
      return res.status(403).json({ error: limitCheck.message });
    }

    // Construct the system prompt for the AI tutor
    const systemPrompt = `You are a strict but helpful tutor. Analyze the user's explanation of the concept "${concept}" for:

1. **Accuracy** - Is the explanation factually correct?
2. **Simplicity** - Is it explained in simple terms without jargon? 
3. **Completeness** - Are key details missing?

Return a JSON object with this EXACT structure:
{
  "score": 85,
  "feedback": "Your explanation is mostly accurate, but you're missing a key detail about how TCP ensures reliability through sequence numbers.",
  "simplification": "TCP is like sending a package with tracking. You send it (data), and you get a receipt (acknowledgment) that it arrived. If you don't get the receipt, you send it again. UDP is like sending a postcard - you just drop it in the mail and hope it arrives, no tracking.",
  "missing_concepts": ["sequence numbers", "acknowledgment system", "retransmission on failure"]
}

Rules:
- score: 0-100 (0 = completely wrong, 100 = perfect)
- feedback: 1-2 sentences summarizing what's good and what needs work
- simplification: Rewrite the explanation in simpler, more accessible terms (2-3 sentences)
- missing_concepts: Array of strings listing key concepts/details that were omitted

Return ONLY valid JSON, no additional text or markdown formatting.`;

    const fullPrompt = `${systemPrompt}\n\nUser's Explanation:\n${explanation}\n\nReturn only valid JSON.`;

    // Call Gemini Edge Function via raw fetch with Service Role Key
    // CRITICAL: Use already-validated variables from initialization (guaranteed to exist)
    const supabaseProjectUrl = supabaseUrl;
    const serviceRoleKey = supabaseServiceKey;

    // Construct the URL
    const edgeFunctionUrl = `${supabaseProjectUrl}/functions/v1/gemini-chat`;

    // Debug Log: Verify key is loaded (only in development, never log keys)
    if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Calling Gemini Edge Function for analysis...');
    console.log('Edge Function URL:', edgeFunctionUrl);
    }

    // Make raw fetch request
    let response;
    try {
      response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          maxTokens: 2048,
        }),
      });

      // Error Handling: Check response.ok
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Edge Function error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Edge Function returned ${response.status} ${response.statusText}: ${errorText}`);
      }
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return res.status(500).json({ error: `AI analysis failed: ${fetchError.message}` });
    }

    // Parse the response
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      const textResponse = await response.text().catch(() => 'Could not read response');
      console.error('Raw response:', textResponse.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse Edge Function response' });
    }

    // Parse the response (Edge Function returns { text: "..." })
    let analysisResult;
    try {
      // Edge Function typically returns { text: "..." } format
      const responseText = data?.text || (typeof data === 'string' ? data : JSON.stringify(data));
      
      // Extract JSON from response (handle markdown code blocks if present)
      let cleanJson = responseText.trim();
      if (cleanJson.includes('```json')) {
        cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
      } else if (cleanJson.includes('```')) {
        cleanJson = cleanJson.replace(/```/g, '').trim();
      }
      
      // Find the JSON object in the response
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }
      
      analysisResult = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('Raw response data:', JSON.stringify(data, null, 2));
      return res.status(500).json({ error: 'Failed to parse AI response. The AI may not have returned valid JSON.' });
    }

    // Validate the structure
    if (typeof analysisResult.score !== 'number' || 
        typeof analysisResult.feedback !== 'string' ||
        typeof analysisResult.simplification !== 'string' ||
        !Array.isArray(analysisResult.missing_concepts)) {
      console.error('❌ Invalid response structure:', analysisResult);
      return res.status(500).json({ error: 'AI returned invalid response structure' });
    }

    console.log('✅ Analysis complete:', {
      score: analysisResult.score,
      missing_concepts_count: analysisResult.missing_concepts.length,
    });

    res.json({
      score: analysisResult.score,
      feedback: analysisResult.feedback,
      simplification: analysisResult.simplification,
      missing_concepts: analysisResult.missing_concepts,
    });
  } catch (e) {
    console.error("❌ Feynman Analysis Error:", e.message);
    console.error("Error details:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/cancel-subscription', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // 1. Get the customer ID from Supabase
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase client not initialized' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return res.status(404).json({ error: 'No Stripe customer found for this user' });
    }

    // 2. Find their active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // 3. Cancel it at the end of the period
    const subscription = subscriptions.data[0];
    const updatedSub = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    // Note: is_pro remains true until subscription is actually deleted
    // The customer.subscription.deleted webhook will set is_pro = false when the period ends

    res.json({ 
      status: 'success', 
      cancel_at: updatedSub.cancel_at,
      cancellationDate: updatedSub.cancel_at 
        ? new Date(updatedSub.cancel_at * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : new Date(updatedSub.current_period_end * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Subscription Details Route
// GET endpoint - reads userId from query parameters
app.get('/get-subscription-details', async (req, res) => {
  // #region agent log
  console.log('🔍 DEBUG: get-subscription-details GET endpoint called');
  logEntry({location:'server.js:434',message:'get-subscription-details GET endpoint called',data:{method:req.method,query:req.query,userId:req.query.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'L'});
  // #endregion
  
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required in query parameters' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Step A: Query Supabase to find the stripe_customer_id
    // #region agent log
    logEntry({location:'server.js:448',message:'Querying database for stripe_customer_id (GET)',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'I'});
    // #endregion
    const { data: user, error: dbError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, is_pro')
      .eq('id', userId)
      .single();

    // #region agent log
    logEntry({location:'server.js:454',message:'Database query result (GET)',data:{hasUser:!!user,hasStripeCustomerId:!!user?.stripe_customer_id,isPro:user?.is_pro,dbError:dbError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'J'});
    // #endregion

    // If stripe_customer_id is missing, return isSubscribed: false
    if (dbError || !user?.stripe_customer_id) {
      // #region agent log
      logEntry({location:'server.js:459',message:'No stripe_customer_id found, returning isSubscribed: false',data:{dbError:dbError?.message,hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'M'});
      // #endregion
      return res.json({ isSubscribed: false });
    }

    // Step B: Use Stripe to find active subscriptions
    // #region agent log
    logEntry({location:'server.js:464',message:'Querying Stripe for subscriptions (GET)',data:{stripeCustomerId:user.stripe_customer_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'N'});
    // #endregion
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      limit: 1,
    });

    // If no subscription found, return isSubscribed: false
    if (subscriptions.data.length === 0) {
      // #region agent log
      logEntry({location:'server.js:472',message:'No subscriptions found in Stripe, returning isSubscribed: false',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'O'});
      // #endregion
      return res.json({ isSubscribed: false });
    }

    const subscription = subscriptions.data[0];
    
    // #region agent log
    logEntry({location:'server.js:478',message:'Subscription found, returning details (GET)',data:{status:subscription.status,currentPeriodEnd:subscription.current_period_end},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'P'});
    // #endregion

    // Return subscription details
    res.json({
      isSubscribed: true,
      plan: 'Pro',
      status: subscription.status, // 'active', 'trialing', 'past_due', etc.
      renewsAt: subscription.current_period_end, // unix timestamp
    });
  } catch (error) {
    // #region agent log
    logEntry({location:'server.js:488',message:'Error in get-subscription-details GET',data:{errorName:error.name,errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'});
    // #endregion
    console.error('Error fetching subscription details (GET):', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint - reads userId from request body
app.post('/get-subscription-details', async (req, res) => {
  // #region agent log
  console.log('🔍 DEBUG: get-subscription-details POST endpoint called');
  logEntry({location:'server.js:490',message:'get-subscription-details POST endpoint called',data:{method:req.method,path:req.path,url:req.url,hasBody:!!req.body,bodyKeys:req.body ? Object.keys(req.body) : [],userId:req.body?.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'});
  // #endregion
  
  try {
    // Extract userId from req.body
    const { userId } = req.body;
    
    // Debug logging
    console.log('🔍 Checking subscription for User ID:', userId);
    
    // Validation: If userId is undefined, return status 400 immediately
    if (!userId || userId === undefined) {
      // #region agent log
      logEntry({location:'server.js:502',message:'Validation failed - userId is undefined',data:{hasBody:!!req.body,bodyKeys:req.body ? Object.keys(req.body) : []},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'Q'});
      // #endregion
      return res.status(400).json({ error: 'User ID is required in request body' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Query Supabase for the stripe_customer_id
    // #region agent log
    logEntry({location:'server.js:511',message:'Querying database for stripe_customer_id',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'I'});
    // #endregion
    const { data: user, error: dbError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, is_pro')
      .eq('id', userId)
      .single();

    // #region agent log
    logEntry({location:'server.js:518',message:'Database query result',data:{hasUser:!!user,hasStripeCustomerId:!!user?.stripe_customer_id,isPro:user?.is_pro,dbError:dbError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'J'});
    // #endregion

    // If the ID is null or missing, return { isSubscribed: false, message: 'No Customer ID found' }
    if (dbError || !user?.stripe_customer_id) {
      console.error('User not found or no Stripe ID:', dbError);
      // #region agent log
      logEntry({location:'server.js:525',message:'No stripe_customer_id found, returning isSubscribed: false',data:{dbError:dbError?.message,hasUser:!!user,hasStripeCustomerId:!!user?.stripe_customer_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'R'});
      // #endregion
      return res.json({ 
        isSubscribed: false, 
        message: 'No Customer ID found' 
      });
    }

    // If the ID exists, call stripe.subscriptions.list and return the plan details
    // #region agent log
    logEntry({location:'server.js:532',message:'Querying Stripe for subscriptions',data:{stripeCustomerId:user.stripe_customer_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'N'});
    // #endregion
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      limit: 1,
    });

    // If no subscription found, return isSubscribed: false
    if (subscriptions.data.length === 0) {
      // #region agent log
      logEntry({location:'server.js:540',message:'No subscriptions found in Stripe, returning isSubscribed: false',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'O'});
      // #endregion
      return res.json({ 
        isSubscribed: false,
        message: 'No active subscription found'
      });
    }

    const subscription = subscriptions.data[0];
    const price = subscription.items.data[0]?.price;

    // #region agent log
    logEntry({location:'server.js:550',message:'Subscription found, returning plan details',data:{status:subscription.status,currentPeriodEnd:subscription.current_period_end,hasPrice:!!price,amount:price?.unit_amount},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'P'});
    // #endregion

    // Return subscription details
    res.json({
      isSubscribed: true,
      plan: 'Pro',
      status: subscription.status, // 'active', 'trialing', 'past_due', etc.
      renewsAt: subscription.current_period_end, // unix timestamp
      amount: price?.unit_amount || 0,
      currency: price?.currency || 'usd',
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelAt: subscription.cancel_at,
    });
  } catch (error) {
    // #region agent log
    logEntry({location:'server.js:568',message:'Error in get-subscription-details POST',data:{errorName:error.name,errorMessage:error.message,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'});
    // #endregion
    console.error('Error fetching subscription details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync Subscription Status Route
// Manually sync subscription status from Stripe to database
app.post('/api/user/sync-subscription', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // 1. Get the user's stripe_customer_id from Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, is_pro')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const stripeCustomerId = profile.stripe_customer_id;

    // 2. If no Stripe customer ID, user is free - ensure DB reflects this
    if (!stripeCustomerId) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_pro: false })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      return res.json({ 
        success: true, 
        message: 'Subscription synced: Free plan',
        is_pro: false 
      });
    }

    // 3. Query Stripe for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10,
    });

    // 4. Find active or trialing subscription
    const activeSubscription = subscriptions.data.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );

    // 5. Update database based on Stripe status
    if (activeSubscription) {
      // User has active subscription in Stripe
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_pro: true,
          pro_expires_at: activeSubscription.current_period_end 
            ? new Date(activeSubscription.current_period_end * 1000).toISOString()
            : null
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      return res.json({ 
        success: true, 
        message: 'Subscription synced: Pro plan active',
        is_pro: true,
        status: activeSubscription.status
      });
    } else {
      // No active subscription in Stripe - set to free
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_pro: false,
          pro_expires_at: null
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      return res.json({ 
        success: true, 
        message: 'Subscription synced: Free plan (no active subscription in Stripe)',
        is_pro: false 
      });
    }
  } catch (error) {
    console.error('Error syncing subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Customer Portal Route
app.post('/create-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('Received portal request for user:', userId);

    // 1. Get the user's stripe_customer_id from Supabase
    const { data: user, error: dbError } = await supabase
      .from('profiles') // Using 'profiles' table to match the rest of the codebase
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (dbError || !user?.stripe_customer_id) {
      console.error('User not found or no Stripe ID:', dbError);
      return res.status(404).json({ error: 'Stripe customer not found' });
    }

    // 2. Create the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: 'http://localhost:5173/subscription', // Where to send them back
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Also register at /api path for proxy compatibility
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('Received portal request for user:', userId);

    // 1. Get the user's stripe_customer_id from Supabase
    const { data: user, error: dbError } = await supabase
      .from('profiles') // Using 'profiles' table to match the rest of the codebase
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (dbError || !user?.stripe_customer_id) {
      console.error('User not found or no Stripe ID:', dbError);
      return res.status(404).json({ error: 'Stripe customer not found' });
    }

    // 2. Create the portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: 'http://localhost:5173/subscription', // Where to send them back
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin User Deletion Endpoint
// CRITICAL: This endpoint requires authentication and proper authorization
// Should be protected with admin-only access in production
app.post('/admin/delete-user', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Verify admin client is initialized (guaranteed to exist due to process.exit(1) checks)
    if (!supabaseAdmin) {
      console.error('❌ ERROR: Supabase Admin client not initialized');
      return res.status(500).json({ error: 'Admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY.' });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️ Admin: Attempting to delete user:', userId);
    }

    // CRITICAL: Use admin.auth.admin.deleteUser() with service role key
    // This bypasses RLS and deletes the user from auth.users
    // With ON DELETE CASCADE constraints, this will automatically delete:
    // - profiles (references auth.users(id))
    // - user_stats (references profiles(id))
    // - decks (references profiles(id))
    // - flashcards (references profiles(id) and decks(id))
    // - user_usage (references profiles(id))
    
    // Try using the admin method directly (Supabase JS v2+)
    let deleteError = null;
    let deleteData = null;
    
    try {
      // Check if admin.auth.admin exists (Supabase JS v2.39+)
      if (supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.deleteUser === 'function') {
        const result = await supabaseAdmin.auth.admin.deleteUser(userId);
        deleteData = result.data;
        deleteError = result.error;
      } else {
        // Fallback: Use REST API directly if admin method not available
        // CRITICAL: Use already-validated variables from initialization (guaranteed to exist)
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ Admin method not available, using REST API directly');
        }
        const deleteUrl = `${supabaseUrl}/auth/v1/admin/users/${userId}`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Content-Type': 'application/json'
          }
        });

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          throw new Error(`Admin API returned ${deleteResponse.status}: ${errorText}`);
        }

        deleteData = await deleteResponse.json().catch(() => ({ success: true }));
      }
    } catch (apiError) {
      console.error('❌ ERROR calling admin delete API:', apiError);
      deleteError = apiError;
    }

    if (deleteError) {
      console.error('❌ ERROR deleting user:', deleteError);
      
      // Provide helpful error messages
      let errorMessage = deleteError.message || 'Unknown error occurred';
      if (errorMessage.includes('foreign key') || errorMessage.includes('constraint') || errorMessage.includes('violates foreign key')) {
        errorMessage = 'Database error deleting user. Foreign key constraints may not have ON DELETE CASCADE. Please run migration 004_add_cascade_delete_constraints.sql';
      } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        errorMessage = 'User not found in auth.users';
      } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        errorMessage = 'Permission denied. Ensure SUPABASE_SERVICE_ROLE_KEY is correct and has admin privileges.';
      }
      
      return res.status(500).json({ error: errorMessage, details: deleteError.message || deleteError });
    }

    console.log('✅ Successfully deleted user:', userId);
    console.log('  - All related data should have been cascaded (profiles, stats, decks, flashcards, etc.)');

    res.json({ 
      success: true, 
      message: 'User deleted successfully',
      userId: userId,
      deletedAt: new Date().toISOString(),
      data: deleteData
    });
  } catch (error) {
    console.error('❌ Unexpected error in admin delete user:', error);
    res.status(500).json({ error: error.message || 'An unexpected error occurred' });
  }
});

// Centralized Error Handler: Catch all unhandled errors
// This MUST be the last middleware before app.listen()
app.use((err, req, res, next) => {
  // Log the full error for server-side debugging
  console.error('❌ Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Don't leak stack traces to clients in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Handle specific error types
  if (err instanceof multer.MulterError) {
    // Multer errors (file upload issues)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 5MB.' 
      });
    }
    return res.status(400).json({ 
      error: 'File upload error: ' + err.message 
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'CORS: Origin not allowed' 
    });
  }

  if (err.message && err.message.includes('rate limit')) {
    // Rate limit errors are handled by express-rate-limit
    // But we catch them here as a fallback
    return res.status(429).json({ 
      error: 'Too many requests, please try again later.' 
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  
  // Build error response - never leak stack traces in production
  let errorResponse = {
    error: isDevelopment ? err.message : 'Internal server error',
  };

  // Only include stack trace in development mode
  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  // For 500+ errors in production, use generic message
  if (statusCode >= 500 && !isDevelopment) {
    errorResponse.error = 'An unexpected error occurred. Please try again later.';
    // Remove any other details that might have leaked
    delete errorResponse.message;
    delete errorResponse.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// 404 Handler: Catch all routes that don't match
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path 
  });
});

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
  if (process.env.NODE_ENV === 'development') {
  console.log('🔍 DEBUG: Registered routes include /get-subscription-details');
  }
  // #region agent log
  logEntry({location:'server.js:485',message:'Server started',data:{port:3000,hasGetSubscriptionRoute:true,routesRegistered:['/get-subscription-details','/create-portal-session','/cancel-subscription','/create-checkout-session']},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'});
  // #endregion
});