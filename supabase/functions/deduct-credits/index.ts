// deduct-credits - 扣除用户积分
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 验证用户身份
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // 创建 Supabase 客户端
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 获取用户信息
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // 解析请求体
    const { amount, description, metadata } = await req.json()

    // 验证参数
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount')
    }

    // 获取用户当前积分
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('credits, total_consumed')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Profile not found')
    }

    // 检查积分是否足够
    if (profile.credits < amount) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          current: profile.credits,
          required: amount
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 扣除积分（使用事务）
    const { data: transaction, error: txError } = await supabaseClient.rpc('deduct_credits_transaction', {
      user_id: user.id,
      amount: amount,
      description: description || 'Image generation',
      metadata: metadata || {}
    })

    if (txError) {
      throw new Error('Failed to deduct credits: ' + txError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: transaction.new_balance,
        transaction_id: transaction.transaction_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
