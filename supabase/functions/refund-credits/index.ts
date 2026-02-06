// refund-credits - 退还用户积分（生成失败时使用）
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { amount, description, metadata } = await req.json()

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount')
    }

    // 获取用户当前积分
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Profile not found')
    }

    // 退还积分
    const newBalance = profile.credits + amount

    const { data: updatedProfile, error: updateError } = await supabaseClient
      .from('profiles')
      .update({ credits: newBalance, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      throw new Error('Failed to update credits: ' + updateError.message)
    }

    // 记录交易
    const { error: txError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'refund',
        amount: amount,
        balance_after: newBalance,
        description: description || 'Refund for failed generation',
        metadata: metadata || {},
        status: 'completed'
      })

    if (txError) {
      console.error('Failed to record transaction:', txError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance
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
