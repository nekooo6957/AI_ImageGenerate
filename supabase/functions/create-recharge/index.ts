// create-recharge - 创建充值订单
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 充值套餐配置（积分: 1积分 = ¥0.08）
const RECHARGE_PACKAGES = {
  'basic': { amount: 9.9, credits: 124 },      // ¥9.9 = 124积分 (约¥9.92)
  'standard': { amount: 29.9, credits: 374 },  // ¥29.9 = 374积分 (约¥29.92)
  'premium': { amount: 49.9, credits: 624 },   // ¥49.9 = 624积分 (约¥49.92)
  'ultimate': { amount: 99.9, credits: 1249 }, // ¥99.9 = 1249积分 (约¥99.92)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    const { package_id, method } = await req.json()

    // 验证充值套餐
    const pkg = RECHARGE_PACKAGES[package_id]
    if (!pkg) {
      throw new Error('Invalid package')
    }

    // 验证支付方式
    if (!['wechat', 'alipay'].includes(method)) {
      throw new Error('Invalid payment method')
    }

    // 创建充值订单
    const { data: order, error: orderError } = await supabaseClient
      .from('recharge_orders')
      .insert({
        user_id: user.id,
        amount: pkg.amount,
        credits: pkg.credits,
        method: method,
        status: 'pending'
      })
      .select()
      .single()

    if (orderError) {
      throw new Error('Failed to create order: ' + orderError.message)
    }

    // TODO: 调用虎皮椒支付 API 创建支付
    // 目前返回模拟数据
    const paymentUrl = `https://pay.xunhupay.com/example/pay?id=${order.id}`

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        amount: pkg.amount,
        credits: pkg.credits,
        payment_url: paymentUrl
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
