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

    const { data: instance } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!instance) {
      return new Response(
        JSON.stringify({ success: false, error: 'No instance found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') ?? '';
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') ?? '';

    const statusResponse = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instance.instance_name}`,
      {
        headers: { 'apikey': evolutionApiKey }
      }
    );

    const statusData = await statusResponse.json();
    console.log('Instance status:', statusData);

    let newStatus = instance.status;
    let phoneNumber = instance.phone_number;

    if (statusData.state === 'open') {
      newStatus = 'connected';
      if (statusData.instance?.owner) {
        phoneNumber = statusData.instance.owner;
      }
    } else if (statusData.state === 'close') {
      newStatus = 'disconnected';
    }

    await supabaseClient
      .from('whatsapp_instances')
      .update({ 
        status: newStatus,
        phone_number: phoneNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', instance.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: newStatus,
        phoneNumber: phoneNumber,
        instance: { ...instance, status: newStatus, phone_number: phoneNumber }
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