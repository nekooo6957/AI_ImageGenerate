// payment-callback - 虎皮椒支付回调处理
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 虎皮椒回调验证签名函数
function verifyXunhuPayCallback(params: any, secret: string): boolean {
  // TODO: 实现虎皮椒签名验证
  // 1. 获取 trade_order_id，total_fee，transaction_id 等参数
  // 2. 按虎皮椒文档计算签名
  // 3. 对比返回的签名
  return true // 暂时返回 true，实际需要实现验证逻辑
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 解析虎皮椒回调数据
    const callbackData = await req.json()

    // 验证签名
    const secret = Deno.env.get('XUNHUPAY_SECRET') || ''
    if (!verifyXunhuPayCallback(callbackData, secret)) {
      throw new Error('Invalid signature')
    }

    const { trade_order_id, status, transaction_id } = callbackData

    // 创建 Supabase 客户端（使用 service_role_key 绕过 RLS）
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 查询订单
    const { data: order, error: orderError } = await supabaseClient
      .from('recharge_orders')
      .select('*')
      .eq('id', trade_order_id)
      .single()

    if (orderError || !order) {
      throw new Error('Order not found')
    }

    // 检查订单状态，避免重复处理
    if (order.status === 'completed') {
      return new Response(
        JSON.stringify({ success: true, message: 'Order already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证支付状态
    if (status !== 'OD') { // OD = 支付成功
      return new Response(
        JSON.stringify({ success: false, message: 'Payment not successful' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 更新订单状态
    const { error: updateError } = await supabaseClient
      .from('recharge_orders')
      .update({
        status: 'completed',
        transaction_id: transaction_id,
        paid_at: new Date().toISOString()
      })
      .eq('id', trade_order_id)

    if (updateError) {
      throw new Error('Failed to update order: ' + updateError.message)
    }

    // 增加用户积分
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('credits')
      .eq('id', order.user_id)
      .single()

    const newBalance = (profile?.credits || 0) + order.credits

    await supabaseClient
      .from('profiles')
      .update({
        credits: newBalance,
        total_recharged: (profile?.total_recharged || 0) + order.amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.user_id)

    // 记录交易
    await supabaseClient
      .from('transactions')
      .insert({
        user_id: order.user_id,
        type: 'recharge',
        amount: order.credits,
        balance_after: newBalance,
        description: `充值 ${order.credits} 积分`,
        metadata: { order_id: trade_order_id, amount: order.amount },
        status: 'completed'
      })

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
