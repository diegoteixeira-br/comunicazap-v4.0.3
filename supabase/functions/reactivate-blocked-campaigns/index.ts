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

  console.log('🔓 Iniciando reativação de campanhas bloqueadas...');

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user_id from request body or auth header
    let userId: string | null = null;
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      userId = userData.user?.id || null;
    }
    
    // Also check body for service-to-service calls
    if (!userId) {
      try {
        const body = await req.json();
        userId = body.user_id;
      } catch {
        // No body provided
      }
    }

    if (!userId) {
      console.log('❌ Nenhum user_id fornecido');
      return new Response(
        JSON.stringify({ success: false, error: 'No user_id provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`👤 Reativando campanhas para usuário: ${userId}`);

    // Buscar campanhas bloqueadas do usuário que ainda estão no futuro
    const { data: blockedCampaigns, error: fetchError } = await supabaseClient
      .from('message_campaigns')
      .select('id, campaign_name, scheduled_at')
      .eq('user_id', userId)
      .eq('status', 'blocked');

    if (fetchError) {
      console.error('❌ Erro ao buscar campanhas bloqueadas:', fetchError);
      throw fetchError;
    }

    if (!blockedCampaigns || blockedCampaigns.length === 0) {
      console.log('✅ Nenhuma campanha bloqueada encontrada');
      return new Response(
        JSON.stringify({ success: true, message: 'No blocked campaigns found', reactivated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontradas ${blockedCampaigns.length} campanhas bloqueadas`);

    let reactivatedCount = 0;
    const now = new Date();

    for (const campaign of blockedCampaigns) {
      // Verificar se a campanha ainda está no futuro
      if (campaign.scheduled_at && new Date(campaign.scheduled_at) > now) {
        const { error: updateError } = await supabaseClient
          .from('message_campaigns')
          .update({ status: 'scheduled' })
          .eq('id', campaign.id);

        if (updateError) {
          console.error(`❌ Erro ao reativar campanha ${campaign.id}:`, updateError);
        } else {
          console.log(`✅ Campanha reativada: ${campaign.campaign_name}`);
          reactivatedCount++;
        }
      } else {
        console.log(`⏭️ Campanha ${campaign.campaign_name} já passou da data agendada, mantendo bloqueada`);
      }
    }

    console.log(`📊 Total reativadas: ${reactivatedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reactivated ${reactivatedCount} campaigns`,
        reactivated: reactivatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
