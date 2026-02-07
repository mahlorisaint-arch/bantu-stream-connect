// supabase/functions/record-view/index.ts
// Edge Function for server-side view deduplication

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contentId, userId, fingerprint } = await req.json()
    
    if (!contentId) {
      return new Response(
        JSON.stringify({ error: 'contentId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Check for existing view in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    let existingViewQuery = supabaseClient
      .from('content_views')
      .select('id, viewed_at')
      .eq('content_id', contentId)
      .gte('viewed_at', twentyFourHoursAgo)
      .limit(1)

    // If we have a user ID, check by user, otherwise check by fingerprint
    if (userId) {
      existingViewQuery = existingViewQuery.eq('viewer_id', userId)
    } else if (fingerprint) {
      // For anonymous users, we need to check by fingerprint
      // You'll need to create a fingerprint column in your content_views table
      existingViewQuery = existingViewQuery.eq('fingerprint', fingerprint)
    } else {
      // If no user ID or fingerprint, we can't deduplicate reliably
      // Still record the view but warn
      console.warn('No user ID or fingerprint provided, cannot deduplicate')
    }

    const { data: existingViews } = await existingViewQuery

    if (existingViews && existingViews.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: 'already_viewed',
          lastView: existingViews[0].viewed_at 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Record the new view
    const viewData: any = {
      content_id: contentId,
      viewed_at: new Date().toISOString(),
      device_type: /Mobile|Android|iPhone|iPad|iPod/i.test(req.headers.get('user-agent') || '') ? 'mobile' : 'desktop'
    }

    if (userId) {
      viewData.viewer_id = userId
    }

    if (fingerprint) {
      viewData.fingerprint = fingerprint
    }

    // Insert view record
    const { data: viewRecord, error: viewError } = await supabaseClient
      .from('content_views')
      .insert(viewData)
      .select()
      .single()

    if (viewError) {
      console.error('Error recording view:', viewError)
      throw viewError
    }

    // Increment the view count in the Content table
    // Use Supabase RPC for atomic increment
    const { error: incrementError } = await supabaseClient.rpc('increment_views', {
      content_id: contentId
    })

    if (incrementError) {
      console.error('Error incrementing view count:', incrementError)
      // Don't throw, the view was recorded even if count increment failed
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        viewId: viewRecord.id,
        message: 'View recorded successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in record-view function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
