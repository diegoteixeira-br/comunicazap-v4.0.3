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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { clients, message, campaignName } = await req.json();

    console.log('Send messages request:', { 
      user: user.id, 
      clientsCount: clients.length,
      campaignName 
    });

    const { data: instance, error: instanceError } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (instanceError || !instance) {
      throw new Error('WhatsApp instance not found. Please connect your WhatsApp first.');
    }

    if (instance.status !== 'connected') {
      throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    const { data: campaign, error: campaignError } = await supabaseClient
      .from('message_campaigns')
      .insert({
        user_id: user.id,
        instance_id: instance.id,
        campaign_name: campaignName || `Campaign ${new Date().toISOString()}`,
        total_contacts: clients.length,
        status: 'in_progress'
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      throw campaignError;
    }

    console.log('Campaign created:', campaign.id);

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL') ?? '';

    const sendPromises = clients.map(async (client: any, index: number) => {
      try {
        const { data: log } = await supabaseClient
          .from('message_logs')
          .insert({
            campaign_id: campaign.id,
            client_name: client["Nome do Cliente"],
            client_phone: client["Telefone do Cliente"],
            message: message.replace('{nome}', client["Nome do Cliente"]),
            status: 'pending'
          })
          .select()
          .single();

        await new Promise(resolve => setTimeout(resolve, index * 3000));

        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName: instance.instance_name,
            nome: client["Nome do Cliente"],
            telefone: client["Telefone do Cliente"],
            mensagem: message.replace('{nome}', client["Nome do Cliente"])
          })
        });

        if (response.ok) {
          await supabaseClient
            .from('message_logs')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', log.id);

          await supabaseClient.rpc('increment_sent_count', { 
            campaign_id: campaign.id 
          });

          return { success: true, client: client["Nome do Cliente"] };
        } else {
          throw new Error(`HTTP ${response.status}`);
        }

      } catch (error: any) {
        console.error(`Failed to send to ${client["Nome do Cliente"]}:`, error);
        
        await supabaseClient
          .from('message_logs')
          .update({ 
            status: 'failed',
            error_message: error.message
          })
          .eq('campaign_id', campaign.id)
          .eq('client_phone', client["Telefone do Cliente"]);

        await supabaseClient.rpc('increment_failed_count', { 
          campaign_id: campaign.id 
        });

        return { success: false, client: client["Nome do Cliente"], error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);

    await supabaseClient
      .from('message_campaigns')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log('Campaign completed:', { successCount, failedCount });

    return new Response(
      JSON.stringify({ 
        success: true,
        campaign: campaign.id,
        results: {
          total: clients.length,
          sent: successCount,
          failed: failedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});