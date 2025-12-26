import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Get allowed origins from environment or use default for development
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'];

// Simple in-memory rate limiting (per IP, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function getCorsHeaders(origin: string | null): Record<string, string> {
  // If wildcard is allowed (development), allow all origins
  if (ALLOWED_ORIGINS.includes('*')) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }
  
  // In production, check if origin is in allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Vary': 'Origin',
    };
  }
  
  // Default: don't set CORS headers (will block cross-origin requests)
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    // First request or window expired - reset counter
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Increment counter
  record.count++;
  return { allowed: true };
}

function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to a default (edge functions don't expose connection IP directly)
  return 'unknown';
}

// Convert string to SHA-1 hash using Web Crypto API
async function sha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toUpperCase();
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check rate limit
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter || 60),
        } 
      }
    );
  }

  try {
    const { password } = await req.json();
    
    // Input validation
    if (!password || typeof password !== 'string') {
      console.error('Invalid password input');
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate password length (prevent DoS via extremely long inputs)
    if (password.length > 1000) {
      console.error('Password input too long');
      return new Response(
        JSON.stringify({ error: 'Password too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate SHA-1 hash of the password
    const hash = await sha1(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    console.log(`Checking password breach for hash prefix: ${prefix} (IP: ${clientIP})`);

    // Query HaveIBeenPwned API with k-anonymity
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'FrostGuard-Security-Check',
      },
    });

    if (!response.ok) {
      console.error(`HIBP API error: ${response.status}`);
      // If HIBP is down, we'll allow the password but log the error
      return new Response(
        JSON.stringify({ breached: false, count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = await response.text();
    const lines = text.split('\r\n');
    
    // Search for our suffix in the returned list
    let breachCount = 0;
    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        breachCount = parseInt(count, 10);
        break;
      }
    }

    const breached = breachCount > 0;
    
    if (breached) {
      console.log(`Password found in ${breachCount} data breaches`);
    } else {
      console.log('Password not found in any known breaches');
    }

    return new Response(
      JSON.stringify({ breached, count: breachCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking password breach:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check password' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
