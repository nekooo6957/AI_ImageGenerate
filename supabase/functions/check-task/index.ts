// ============================================
// Nano Banana Pro - Check Task Edge Function
// ============================================
// Description: Polls APIMart API for task status and updates generation logs
// Features:
// - Authenticates user requests
// - Checks APIMart task status
// - Updates generation logs in database
// - Refunds credits on failed generations
// - Returns task status with result URLs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Type definitions for Deno runtime
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined
    }
  }
}

// ============================================
// Constants & Types
// ============================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APIMART_API_URL = 'https://api.apimart.ai/v1/tasks'

type TaskStatus = 'succeeded' | 'failed' | 'processing' | 'unknown'

interface CheckTaskRequest {
  task_id: string
  generation_id?: string
  transaction_id?: string
}

interface APIMartResponse {
  task_status?: TaskStatus
  result_urls?: string[]
  error?: {
    message?: string
  }
}

interface RefundResult {
  creditsRefunded: boolean
  newBalance: number
}

// ============================================
// Utility Functions
// ============================================

/**
 * Creates a standardized JSON response
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  })
}

/**
 * Creates an error response
 */
function errorResponse(message: string, status = 500, details?: string): Response {
  return jsonResponse({
    error: message,
    ...(details && { details })
  }, status)
}

/**
 * Updates generation log in database
 */
async function updateGenerationLog(
  supabase: ReturnType<typeof createClient>,
  generationId: string | undefined,
  userId: string,
  status: 'succeeded' | 'failed',
  resultUrls?: string[]
): Promise<void> {
  if (!generationId) return

  const updateData: Record<string, unknown> = {
    status,
    completed_at: new Date().toISOString()
  }

  if (resultUrls) {
    updateData.result_urls = resultUrls
  }

  const { error } = await supabase
    .from('generation_logs')
    .update(updateData)
    .eq('id', generationId)
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to update generation log:', error)
  }
}

/**
 * Refunds credits for failed generation
 */
async function refundCredits(
  supabase: ReturnType<typeof createClient>,
  transactionId: string | undefined
): Promise<RefundResult> {
  if (!transactionId) {
    return { creditsRefunded: false, newBalance: 0 }
  }

  try {
    const { data } = await supabase.rpc('refund_credits', {
      p_transaction_id: transactionId
    })

    if (data && Array.isArray(data) && data.length > 0 && data[0].success) {
      return {
        creditsRefunded: true,
        newBalance: data[0].new_balance || 0
      }
    }
  } catch (error) {
    console.error('Refund failed:', error)
  }

  return { creditsRefunded: false, newBalance: 0 }
}

// ============================================
// Main Handler
// ============================================

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
    // ============================================
    // 1. Environment Setup & Authentication
    // ============================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401)
    }

    // Try multiple environment variable naming conventions
    const supabaseUrl = getEnvVar('SUPABASE_PROJECT_URL', 'PROJECT_URL')
    const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    const apimartKey = getEnvVar('SUPABASE_APIMART_KEY', 'APIMART_KEY')

    if (!supabaseUrl) {
      return errorResponse('Server configuration error: Missing PROJECT_URL environment variable', 500)
    }

    if (!supabaseServiceKey) {
      return errorResponse('Server configuration error: Missing SERVICE_ROLE_KEY environment variable', 500)
    }

    if (!apimartKey) {
      return errorResponse('Server configuration error: Missing APIMART_KEY environment variable', 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return errorResponse('Unauthorized', 401, authError?.message)
    }

    // ============================================
    // 2. Parse & Validate Request
    // ============================================
    const { task_id, generation_id, transaction_id }: CheckTaskRequest = await req.json()

    if (!task_id) {
      return errorResponse('Missing required parameter: task_id', 400)
    }

    // ============================================
    // 3. Query APIMart API
    // ============================================
    const apimartResponse = await fetch(
      `${APIMART_API_URL}/${task_id}?language=zh`,
      { headers: { 'Authorization': `Bearer ${apimartKey}` } }
    )

    if (!apimartResponse.ok) {
      console.error(`APIMart API error: ${apimartResponse.status}`)
      return errorResponse(
        'Failed to check task status with APIMart API',
        502,
        `Status: ${apimartResponse.status}`
      )
    }

    const apimartData: APIMartResponse = await apimartResponse.json()
    const status: TaskStatus = apimartData.task_status || 'unknown'

    // ============================================
    // 4. Handle Task Status
    // ============================================
    switch (status) {
      case 'succeeded': {
        const resultUrls = apimartData.result_urls || []
        await updateGenerationLog(supabase, generation_id, user.id, 'succeeded', resultUrls)

        return jsonResponse({
          status: 'succeeded',
          task_id,
          urls: resultUrls,
          message: '生成成功'
        })
      }

      case 'failed': {
        const errorMessage = apimartData.error?.message || 'Generation failed'
        const { creditsRefunded, newBalance } = await refundCredits(supabase, transaction_id)
        await updateGenerationLog(supabase, generation_id, user.id, 'failed')

        return jsonResponse({
          status: 'failed',
          task_id,
          error: errorMessage,
          credits_refunded: creditsRefunded,
          new_balance: newBalance,
          message: creditsRefunded
            ? `生成失败，积分已退还，当前余额 ${newBalance} 积分`
            : '生成失败'
        })
      }

      case 'processing':
      case 'unknown':
      default:
        return jsonResponse({
          status: 'processing',
          task_id,
          message: '正在生成中...'
        })
    }

  } catch (error) {
    console.error('Check task error:', error)
    return errorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : String(error)
    )
  }
})
