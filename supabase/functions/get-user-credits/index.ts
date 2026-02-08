// ============================================
// Nano Banana Pro - Get User Credits Edge Function
// ============================================
// Description: Get user credit balance and transaction history
// This function:
// 1. Validates user authentication
// 2. Gets user credit balance
// 3. Gets recent transaction history
// 4. Returns combined credit information

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Get environment variable with fallback support
 * Tries multiple naming conventions for compatibility
 */
function getEnvVar(...names: string[]): string | undefined {
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value) return value
  }
  return undefined
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. Environment setup & Validate user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Try multiple environment variable naming conventions
    const supabaseUrl = getEnvVar('SUPABASE_PROJECT_URL', 'PROJECT_URL')
    const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')

    if (!supabaseUrl) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing PROJECT_URL environment variable' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing SERVICE_ROLE_KEY environment variable' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Extract token from Authorization header (format: "Bearer <token>")
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Parse request parameters
    const url = new URL(req.url)
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 20

    if (limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid limit. Must be between 1 and 100' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Get user credit balance
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (creditsError && creditsError.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which is ok (user has no credits yet)
      console.error('Error fetching credits:', creditsError)
    }

    // 4. Get recent transaction history
    const { data: transactions, error: transactionsError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError)
    }

    // 5. Get generation statistics
    const { data: stats, error: statsError } = await supabase
      .from('generation_logs')
      .select('status')
      .eq('user_id', user.id)

    let generationStats = { total: 0, succeeded: 0, failed: 0, pending: 0 }
    if (!statsError && stats) {
      generationStats.total = stats.length
      generationStats.succeeded = stats.filter(s => s.status === 'succeeded').length
      generationStats.failed = stats.filter(s => s.status === 'failed').length
      generationStats.pending = stats.filter(s => s.status === 'pending').length
    }

    // 6. Return combined credit information
    return new Response(JSON.stringify({
      credits: credits || {
        balance: 0,
        total_recharged: 0,
        total_consumed: 0
      },
      transactions: transactions || [],
      generation_stats: generationStats
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Get user credits error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
