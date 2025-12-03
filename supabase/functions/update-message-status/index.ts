import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { log_id, status, campaign_id, error_message } = body;

    console.log(`[CALLBACK] Recebido: log_id=${log_id}, status=${status}, campaign_id=${campaign_id}`);

    if (!log_id || !status || !campaign_id) {
      throw new Error('Missing required fields: log_id, status, campaign_id');
    }

    // 1. Atualizar status do message_log
    const updateData: any = { 
      status: status,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    };
    
    if (error_message) {
      updateData.error_message = error_message;
    }

    const { error: logError } = await supabaseClient
      .from('message_logs')
      .update(updateData)
      .eq('id', log_id);

    if (logError) {
      console.error(`[CALLBACK] Erro ao atualizar log:`, logError);
      throw logError;
    }

    console.log(`[CALLBACK] Log ${log_id} atualizado para: ${status}`);

    // 2. Incrementar contador na campanha
    if (status === 'sent') {
      const { error: sentError } = await supabaseClient.rpc('increment_sent_count', { 
        campaign_id: campaign_id 
      });
      if (sentError) console.error(`[CALLBACK] Erro ao incrementar sent_count:`, sentError);
      else console.log(`[CALLBACK] sent_count incrementado`);
    } else if (status === 'failed') {
      const { error: failedError } = await supabaseClient.rpc('increment_failed_count', { 
        campaign_id: campaign_id 
      });
      if (failedError) console.error(`[CALLBACK] Erro ao incrementar failed_count:`, failedError);
      else console.log(`[CALLBACK] failed_count incrementado`);
    }

    // 3. Verificar se todas mensagens foram processadas
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('message_campaigns')
      .select('total_contacts, sent_count, failed_count')
      .eq('id', campaign_id)
      .single();

    if (campaignError) {
      console.error(`[CALLBACK] Erro ao buscar campanha:`, campaignError);
    } else if (campaign) {
      const totalProcessed = (campaign.sent_count || 0) + (campaign.failed_count || 0);
      console.log(`[CALLBACK] Progresso: ${totalProcessed}/${campaign.total_contacts}`);

      // Verificar se também há contatos bloqueados (que não entram nos sent/failed)
      const { count: blockedCount } = await supabaseClient
        .from('message_logs')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign_id)
        .eq('status', 'blocked');

      const totalWithBlocked = totalProcessed + (blockedCount || 0);

      if (totalWithBlocked >= campaign.total_contacts) {
        console.log(`[CALLBACK] ✅ Campanha ${campaign_id} CONCLUÍDA!`);
        
        const { error: completeError } = await supabaseClient
          .from('message_campaigns')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', campaign_id);

        if (completeError) {
          console.error(`[CALLBACK] Erro ao marcar campanha como concluída:`, completeError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Status updated to ${status}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CALLBACK] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
