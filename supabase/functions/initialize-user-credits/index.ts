// ============================================
// Nano Banana Pro - Initialize User Credits Edge Function
// ============================================
// Description: Initialize user credits account with bonus credits
// This function:
// 1. Validates user authentication
// 2. Creates user credits account with initial bonus
// 3. Creates default project
// 4. Returns initialization result

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initial bonus credits for new users (set to 0 to disable)
const INITIAL_BONUS_CREDITS = 0

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. Validate user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_PROJECT_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    // 2. Check if user credits already exist
    const { data: existingCredits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (existingCredits) {
      return new Response(JSON.stringify({
        success: true,
        already_initialized: true,
        credits: existingCredits,
        message: '用户积分已初始化'
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // 3. Initialize user credits with bonus
    const { data: creditData, error: creditError } = await supabase.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: INITIAL_BONUS_CREDITS,
      p_description: '新用户注册奖励',
      p_metadata: { type: 'signup_bonus' },
      p_type: 'bonus'
    })

    if (creditError) {
      console.error('Failed to initialize credits:', creditError)
      return new Response(
        JSON.stringify({ error: 'Failed to initialize credits', details: creditError.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Create default project
    const { error: projectError } = await supabase
      .from('user_projects')
      .insert({
        user_id: user.id,
        name: '默认项目',
        is_default: true
      })

    if (projectError) {
      console.error('Failed to create default project:', projectError)
      // Don't fail the request, just log the error
    }

    // 5. Return success response
    return new Response(JSON.stringify({
      success: true,
      already_initialized: false,
      initial_bonus: INITIAL_BONUS_CREDITS,
      balance: creditData?.[0]?.new_balance || INITIAL_BONUS_CREDITS,
      transaction_id: creditData?.[0]?.transaction_id,
      message: `欢迎注册！已赠送 ${INITIAL_BONUS_CREDITS} 积分`
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Initialize user credits error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
