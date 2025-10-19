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

    console.log('Creating instance for user:', user.id);

    // Verificar se já existe uma instância
    const { data: existingInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingInstance && existingInstance.status === 'connected') {
      // If API key is missing for a connected instance, warn so the user can refresh it later
      if (!existingInstance.api_key) {
        console.warn('Connected instance has no API key saved. Consider refreshing the instance token.');
      }
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Instance already connected',
          instance: existingInstance 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error('Evolution API configuration missing');
    }
    
    const instanceName = `user-${user.id.substring(0, 8)}-${Date.now()}`;

    console.log('Creating Evolution API instance:', instanceName);

    const createInstanceResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });

    if (!createInstanceResponse.ok) {
      const errorText = await createInstanceResponse.text();
      console.error('Evolution API error:', errorText);
      throw new Error(`Failed to create instance: ${errorText}`);
    }

    const evolutionData = await createInstanceResponse.json();
    console.log('Evolution API response:', evolutionData);

    // Try to capture the per-instance API key (token) from the create response
    let instanceApiKey: string | null = (
      evolutionData?.hash ||
      evolutionData?.instance?.hash ||
      evolutionData?.instance?.apikey ||
      evolutionData?.instance?.token ||
      evolutionData?.hash?.apikey ||
      evolutionData?.hash?.token ||
      evolutionData?.apikey ||
      evolutionData?.token ||
      null
    );
    console.log('Instance API key from create:', instanceApiKey ? `Found: ${instanceApiKey.substring(0, 8)}...` : 'Missing');
    console.log('Full Evolution create response:', JSON.stringify(evolutionData, null, 2));

    const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey
      }
    });

    const connectData = await connectResponse.json();
    console.log('Connect response:', connectData);

    // If still missing, try to extract it from the connect response
    if (!instanceApiKey) {
      const candidateFromConnect: string | null = (
        connectData?.hash ||
        connectData?.instance?.hash ||
        connectData?.instance?.apikey ||
        connectData?.instance?.token ||
        connectData?.hash?.apikey ||
        connectData?.hash?.token ||
        connectData?.apikey ||
        connectData?.token ||
        null
      );
      if (candidateFromConnect) {
        instanceApiKey = candidateFromConnect;
        console.log('Instance API key obtained from connect response:', instanceApiKey.substring(0, 8) + '...');
      } else {
        console.warn('Instance API key still missing after connect response');
        console.log('Full Connect response:', JSON.stringify(connectData, null, 2));
      }
    }
    
    // Final validation
    if (!instanceApiKey) {
      console.error('CRITICAL: Could not obtain instance API key. Messages will fail!');
    } else {
      console.log('Instance API key confirmed for storage:', instanceApiKey.substring(0, 8) + '...');
    }

    const { data: instanceData, error: insertError } = await supabaseClient
      .from('whatsapp_instances')
      .upsert({
        user_id: user.id,
        instance_name: instanceName,
        instance_id: instanceApiKey || evolutionData.instance?.instanceId || instanceName,
        status: 'pending',
        qr_code: connectData.qrcode?.base64 || connectData.base64,
        qr_code_updated_at: new Date().toISOString(),
        api_key: instanceApiKey ?? undefined
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      throw insertError;
    }

    console.log('Instance created successfully:', instanceData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        instance: instanceData,
        qrCode: connectData.qrcode?.base64 || connectData.base64
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