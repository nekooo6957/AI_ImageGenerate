// ============================================
// Nano Banana Pro - Generate Image Edge Function
// ============================================
// Description: Generate images using APIMart API with credit validation
// This function:
// 1. Validates user authentication
// 2. Checks and deducts user credits
// 3. Calls APIMart API to generate images
// 4. Creates generation log
// 5. Returns task ID and transaction info

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credit cost rules
const COST_RULES: Record<string, number> = {
  '1K': 5,
  '2K': 5,
  '4K': 10,
}

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

    // 2. Parse request parameters
    const { prompt, size, resolution, n = 1, project_id } = await req.json()

    // Validate parameters
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!resolution || !COST_RULES[resolution]) {
      return new Response(
        JSON.stringify({ error: 'Invalid resolution. Must be 1K, 2K, or 4K' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (n < 1 || n > 4) {
      return new Response(
        JSON.stringify({ error: 'Invalid number of images. Must be between 1 and 4' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Calculate credit cost
    const cost = COST_RULES[resolution] * n

    // 4. Validate and deduct credits
    const { data: creditData, error: creditError } = await supabase.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_description: `生成 ${resolution} 图片 × ${n}张`,
      p_metadata: { resolution, count: n, project_id, size }
    })

    if (creditError) {
      console.error('Credit deduction error:', creditError)
      return new Response(
        JSON.stringify({ error: 'Failed to validate credits', details: creditError.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!creditData || creditData.length === 0 || !creditData[0].success) {
      const currentBalance = creditData?.[0]?.new_balance || 0
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          required: cost,
          balance: currentBalance,
          message: `需要 ${cost} 积分，当前余额 ${currentBalance} 积分`
        }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const transactionId = creditData[0].transaction_id
    const newBalance = creditData[0].new_balance

    // 5. Call APIMart API
    const apimartKey = Deno.env.get('SUPABASE_APIMART_KEY')
    if (!apimartKey) {
      // Refund credits if API key is not configured
      await supabase.rpc('refund_credits', { p_transaction_id: transactionId })
      return new Response(
        JSON.stringify({ error: 'Server configuration error', credits_refunded: cost }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const apimartResponse = await fetch('https://api.apimart.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apimartKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-3-pro-image-preview',
        prompt,
        size: size || '1:1',
        n,
        resolution,
        image_urls: []
      })
    })

    if (!apimartResponse.ok) {
      // API call failed, refund credits
      await supabase.rpc('refund_credits', { p_transaction_id: transactionId })
      return new Response(
        JSON.stringify({
          error: 'APIMart API request failed',
          status: apimartResponse.status,
          credits_refunded: cost
        }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const apimartData = await apimartResponse.json()

    if (!apimartData.task_id) {
      // Invalid API response, refund credits
      await supabase.rpc('refund_credits', { p_transaction_id: transactionId })
      return new Response(
        JSON.stringify({
          error: 'Invalid APIMart API response',
          credits_refunded: cost
        }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Create generation log
    const { data: logData, error: logError } = await supabase
      .from('generation_logs')
      .insert({
        user_id: user.id,
        project_id,
        prompt,
        config: { size, resolution, n },
        cost,
        apimart_task_id: apimartData.task_id,
        status: 'pending'
      })
      .select()
      .single()

    if (logError) {
      console.error('Failed to create generation log:', logError)
      // Don't fail the request, just log the error
    }

    // 7. Return success response
    return new Response(JSON.stringify({
      success: true,
      task_id: apimartData.task_id,
      generation_id: logData?.id,
      transaction_id: transactionId,
      new_balance: newBalance,
      cost: cost,
      message: `已扣除 ${cost} 积分，当前余额 ${newBalance} 积分`
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Generate image error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
