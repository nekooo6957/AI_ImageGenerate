// generate-image - 图片生成代理（隐藏 APIMart API Key）
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 从环境变量获取 API Key
const APIMART_KEY = Deno.env.get('APIMART_KEY') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    const { prompt, size, n, resolution, image_urls, project_id } = await req.json()

    // 计算积分消耗
    const costPerImage = resolution === '4K' ? 10 : 5
    const totalCost = costPerImage * (n || 1)

    // 检查用户积分是否足够
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single()

    if (!profile || profile.credits < totalCost) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          current: profile?.credits || 0,
          required: totalCost
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 调用 APIMart API
    const apiResponse = await fetch('https://api.apimart.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIMART_KEY}`
      },
      body: JSON.stringify({
        model: 'gemini-3-pro-image-preview',
        prompt: prompt,
        size: size || '1024x1024',
        n: n || 1,
        resolution: resolution || '1K',
        image_urls: image_urls || []
      })
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      throw new Error(`APIMart API error: ${apiResponse.status} - ${errorText}`)
    }

    const apiData = await apiResponse.json()

    // 扣除积分
    const { data: transaction } = await supabaseClient.rpc('deduct_credits_transaction', {
      user_id: user.id,
      amount: totalCost,
      description: `生成 ${n || 1} 张图片 (${resolution})`,
      metadata: { project_id, prompt, size, resolution }
    })

    // 记录生成日志
    await supabaseClient
      .from('generation_logs')
      .insert({
        user_id: user.id,
        project_id: project_id || 'default',
        prompt: prompt,
        config: { size, n, resolution },
        cost: totalCost,
        apimart_task_id: apiData.task_id || null,
        status: 'pending'
      })

    return new Response(
      JSON.stringify({
        success: true,
        task_id: apiData.task_id,
        new_balance: transaction?.new_balance,
        cost: totalCost
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
