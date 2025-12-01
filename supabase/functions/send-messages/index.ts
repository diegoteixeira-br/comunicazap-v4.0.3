import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações de comportamento humano
const MIN_DELAY_BETWEEN_MESSAGES = 5000; // Base: 5s
const MAX_DELAY_BETWEEN_MESSAGES = 11000; // Base: 11s
const GAUSSIAN_MEAN = 8000; // Média: 8s
const GAUSSIAN_STD_DEV = 3000; // Desvio padrão: 3s
const BATCH_SIZE = 5; // Fixo em 5 - limite do WhatsApp para mesma mensagem
const MIN_BATCH_PAUSE = 120000; // 120s (2 min) - pausa obrigatória entre blocos
const MAX_BATCH_PAUSE = 240000; // 240s (4 min) - pausa máxima entre blocos
const WARMUP_MESSAGES = 10; // Primeiras 10 msgs mais lentas
const LONG_BREAK_CHANCE = 0.10; // 10% chance
const VERY_LONG_BREAK_CHANCE = 0.05; // 5% chance
const MAX_CONSECUTIVE_ERRORS = 3;
const ERROR_RECOVERY_PAUSE = 180000; // 3 minutos
const REQUEST_TIMEOUT = 30000; // 30 segundos
const BASE_TYPING_SPEED = 200; // caracteres por minuto
const MIN_TYPING_DELAY = 2000; // 2s mínimo
const MAX_TYPING_DELAY = 15000; // 15s máximo

// Funções auxiliares
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Escapar texto para ser seguro em JSON dentro do n8n
const escapeTextForJson = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')     // Backslash primeiro
    .replace(/\n/g, '\\n')      // Nova linha → \n
    .replace(/\r/g, '\\r')      // Retorno de carro → \r
    .replace(/\t/g, '\\t')      // Tab → \t
    .replace(/"/g, '\\"');      // Aspas → \"
};

const getRandomDelay = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Distribuição Gaussiana para delays mais naturais
const gaussianRandom = (mean: number, stdDev: number): number => {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const result = Math.round(mean + z * stdDev);
  // Garantir que está dentro de limites razoáveis
  return Math.max(MIN_DELAY_BETWEEN_MESSAGES, Math.min(MAX_DELAY_BETWEEN_MESSAGES, result));
};

// Calcular delay de digitação baseado no tamanho da mensagem
const calculateTypingDelay = (message: string): number => {
  const charCount = message.length;
  const calculatedDelay = (charCount / BASE_TYPING_SPEED) * 60 * 1000;
  return Math.min(Math.max(calculatedDelay, MIN_TYPING_DELAY), MAX_TYPING_DELAY);
};

// Multiplicador de warm-up para primeiras mensagens
const getWarmupMultiplier = (messageIndex: number): number => {
  if (messageIndex < 3) return 3.0;   // 3x mais lento
  if (messageIndex < 6) return 2.0;   // 2x mais lento
  if (messageIndex < WARMUP_MESSAGES) return 1.5; // 1.5x mais lento
  return 1.0; // Velocidade normal
};

// Chance de pausas longas
const shouldTakeLongBreak = (): boolean => Math.random() < LONG_BREAK_CHANCE;
const shouldTakeVeryLongBreak = (): boolean => Math.random() < VERY_LONG_BREAK_CHANCE;

// Tamanho de lote fixo em 5 (limite do WhatsApp)
const getBatchSize = (): number => BATCH_SIZE;

// Verificar status da conexão do WhatsApp
async function checkConnectionStatus(instanceName: string, apiKey: string): Promise<boolean> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    if (!evolutionApiUrl) return true; // Se não tiver URL configurada, assumir conectado
    
    const response = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
      { 
        headers: { 'apikey': apiKey },
        signal: AbortSignal.timeout(10000)
      }
    );
    
    if (!response.ok) return true; // Se falhar a verificação, continuar tentando
    
    const data = await response.json();
    const isConnected = data?.instance?.state === 'open';
    console.log(`📡 Status da conexão: ${isConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    return isConnected;
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return true; // Em caso de erro, assumir conectado para não bloquear
  }
}

// Sistema de retry com backoff exponencial
async function sendWithRetry(
  n8nWebhookUrl: string,
  payload: any,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string; response?: Response }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      const startTime = Date.now();
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        console.log(`✅ Sucesso em ${responseTime}ms`);
        return { success: true, response };
      }
      
      // Se não for erro de servidor, não tentar novamente
      if (![500, 502, 503].includes(response.status)) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou (HTTP ${response.status})`);
      
    } catch (error: any) {
      console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
      
      if (attempt === maxRetries) {
        return { success: false, error: error.message };
      }
    }
    
    // Backoff exponencial: 5s, 10s, 20s
    if (attempt < maxRetries) {
      const backoffDelay = 5000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Aguardando ${backoffDelay/1000}s antes de retry...`);
      await sleep(backoffDelay);
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

// Pausar campanha
async function pauseCampaign(
  supabaseClient: any,
  campaignId: string,
  reason: string
) {
  await supabaseClient
    .from('message_campaigns')
    .update({ 
      status: 'paused',
      completed_at: new Date().toISOString()
    })
    .eq('id', campaignId);
  
  console.log(`⏸️ Campanha pausada: ${reason}`);
}

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

    // Input validation schema
    const clientSchema = z.object({
      "Nome do Cliente": z.string().trim().min(1, "Client name is required").max(100, "Client name too long"),
      "Telefone do Cliente": z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
    });

    const requestSchema = z.object({
      clients: z.array(clientSchema).optional().nullable(),
      targetTags: z.array(z.string()).optional().nullable(),
      message: z.string().trim().max(1000, "Message too long").optional().nullable(),
      messageVariations: z.array(z.string().trim().max(1000, "Message too long")).optional().nullable(),
      image: z.string().optional().nullable(),
      campaignName: z.string().trim().max(100, "Campaign name too long").optional().nullable()
    });

    // Validate input
    const validatedData = requestSchema.parse(await req.json());
    const { clients: providedClients, targetTags, message, messageVariations, image, campaignName } = validatedData;
    
    let clients = providedClients || [];
    
    // If target tags are provided, fetch contacts from database
    if (targetTags && targetTags.length > 0) {
      console.log('Fetching contacts by tags:', targetTags);
      
      const { data: contactsFromDb, error: contactsError } = await supabaseClient
        .from('contacts')
        .select('phone_number, name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .contains('tags', targetTags);
      
      if (contactsError) {
        console.error('Error fetching contacts:', contactsError);
        throw contactsError;
      }
      
      clients = contactsFromDb.map(contact => ({
        "Nome do Cliente": contact.name || contact.phone_number,
        "Telefone do Cliente": contact.phone_number
      }));
      
      console.log(`Found ${clients.length} contacts with tags`);
    }
    
    // Validate we have clients
    if (!clients || clients.length === 0) {
      throw new Error('No clients provided or found with the specified tags');
    }
    
    if (clients.length > 1000) {
      throw new Error('Maximum 1000 clients per campaign');
    }

    // Usar variações se fornecidas, senão usar mensagem única
    const variations = messageVariations && messageVariations.length > 0 
      ? messageVariations 
      : (message ? [message] : []);

    // Validar que ao menos mensagem ou imagem está presente
    if (variations.length === 0 && !image) {
      throw new Error('Either message or image is required');
    }

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
        message_variations: variations,
        target_tags: targetTags || [],
        status: 'in_progress'
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Campaign creation error:', campaignError);
      throw campaignError;
    }

    console.log('Campaign created:', campaign.id);

    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    
    if (!n8nWebhookUrl) {
      throw new Error('N8N webhook URL not configured');
    }
    
    if (!instance.api_key) {
      throw new Error('Instance API key missing. Please reconnect your WhatsApp.');
    }

    // Upload image to Supabase Storage if provided
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    if (image) {
      try {
        console.log('Uploading media to Supabase Storage...');
        
        // Extract base64 data and mime type
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid image format');
        }
        
        mediaType = matches[1];
        const base64Data = matches[2];
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Generate unique filename
        const extension = mediaType.split('/')[1];
        const fileName = `${user.id}/${campaign.id}.${extension}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient
          .storage
          .from('campaign-media')
          .upload(fileName, bytes, {
            contentType: mediaType,
            upsert: false
          });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabaseClient
          .storage
          .from('campaign-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl;
        console.log('Media uploaded successfully:', mediaUrl);
        
      } catch (uploadError: any) {
        console.error('Failed to upload media:', uploadError);
        throw new Error(`Failed to upload media: ${uploadError.message}`);
      }
    }

    // Retornar resposta imediata e processar em background
    const backgroundTask = async () => {
      const results = [];
      let consecutiveErrors = 0;
      let successCount = 0;
      let failedCount = 0;
      let messagesInCurrentBatch = 0;

      console.log(`\n🚀 Iniciando envio de ${clients.length} mensagens com comportamento humano...`);
      console.log(`📊 Configuração: Warm-up de ${WARMUP_MESSAGES} msgs, lotes fixos de ${BATCH_SIZE} msgs`);
      console.log(`⚠️ Limite WhatsApp: máximo 5 mensagens iguais antes de pausa de 2-4 min`);
      console.log(`📝 Variações disponíveis: ${variations.length}`);

      // Enviar mensagens sequencialmente com delays e verificações
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        
        // Verificar conexão periodicamente a cada bloco de 5
        if (i > 0 && messagesInCurrentBatch >= BATCH_SIZE) {
          const isConnected = await checkConnectionStatus(instance.instance_name, instance.api_key);
          if (!isConnected) {
            console.error('❌ WhatsApp desconectado! Pausando campanha...');
            await pauseCampaign(supabaseClient, campaign.id, 'WhatsApp disconnected');
            break;
          }
        }
        
        try {
          // Check contact status in contacts table
          const { data: contact } = await supabaseClient
            .from('contacts')
            .select('status')
            .eq('user_id', user.id)
            .eq('phone_number', client["Telefone do Cliente"])
            .maybeSingle();

          if (contact?.status === 'unsubscribed') {
            console.log(`⛔ ${client["Nome do Cliente"]} optou por sair, pulando...`);
            
            // Log as blocked
            await supabaseClient
              .from('message_logs')
              .insert({
                campaign_id: campaign.id,
                client_name: client["Nome do Cliente"],
                client_phone: client["Telefone do Cliente"],
                message: '[Bloqueado - Opt-out]',
                status: 'blocked'
              });

            continue; // Skip to next contact
          }
          
          // If contact doesn't exist in contacts table and not from targetTags, insert it
          if (!contact && !targetTags) {
            console.log(`➕ Adicionando ${client["Nome do Cliente"]} aos contatos`);
            await supabaseClient
              .from('contacts')
              .insert({
                user_id: user.id,
                phone_number: client["Telefone do Cliente"],
                name: client["Nome do Cliente"],
                status: 'active'
              })
              .select()
              .single();
          }

          // Selecionar a variação de mensagem POR BLOCO de 5 (não por contato individual)
          const blockIndex = Math.floor(i / BATCH_SIZE);
          const variationIndex = variations.length > 0 ? blockIndex % variations.length : 0;
          const selectedMessage = variations[variationIndex] || '';
          const personalizedMessage = selectedMessage.replace('{nome}', client["Nome do Cliente"]);
          
          console.log(`📦 Bloco ${blockIndex + 1}, Variação ${variationIndex + 1}/${variations.length}`);
          
          const { data: log } = await supabaseClient
            .from('message_logs')
            .insert({
              campaign_id: campaign.id,
              client_name: client["Nome do Cliente"],
              client_phone: client["Telefone do Cliente"],
              message: personalizedMessage || (mediaUrl ? `[Mídia: ${mediaUrl}]` : ''),
              message_variation_index: variationIndex,
              status: 'pending'
            })
            .select()
            .single();

          // Calcular delay de digitação baseado no tamanho da mensagem
          const typingDelay = personalizedMessage?.trim() 
            ? calculateTypingDelay(personalizedMessage)
            : MIN_TYPING_DELAY;

          // Escapar o texto para JSON seguro
          const safeText = escapeTextForJson(personalizedMessage);

          const payload: any = {
            instanceName: instance.instance_name,
            api_key: instance.api_key,
            number: client["Telefone do Cliente"],
            options: {
              delay: typingDelay,
              presence: "composing" // Simula "digitando..."
            }
          };

          // Adicionar texto escapado se existir
          if (safeText?.trim()) {
            payload.text = safeText;
          }

          // Adicionar URL da mídia se existir
          if (mediaUrl) {
            payload.mediaUrl = mediaUrl;
            payload.mediaType = mediaType;
          }

          console.log(`\n📤 [${i + 1}/${clients.length}] Enviando para ${client["Nome do Cliente"]}...`);
          console.log(`⌨️ Simulando digitação: ${typingDelay}ms`);
          
          const sendResult = await sendWithRetry(n8nWebhookUrl, payload);

          if (sendResult.success) {
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

            successCount++;
            consecutiveErrors = 0; // Reset contador de erros
            results.push({ success: true, client: client["Nome do Cliente"] });
            console.log(`📊 Progresso: ${successCount} enviados | ${failedCount} falhas`);
          } else {
            throw new Error(sendResult.error || 'Send failed');
          }

        } catch (error: any) {
          console.error(`❌ Falha ao enviar para ${client["Nome do Cliente"]}:`, error.message);
          
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

          failedCount++;
          consecutiveErrors++;
          results.push({ success: false, client: client["Nome do Cliente"], error: error.message });
          
          // Pausa de recuperação em caso de erros consecutivos
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.log(`\n🚨 ${MAX_CONSECUTIVE_ERRORS} erros consecutivos detectados!`);
            console.log(`⏸️ Pausando ${ERROR_RECOVERY_PAUSE/1000}s para recuperação...`);
            await sleep(ERROR_RECOVERY_PAUSE);
            
            // Re-verificar conexão após recuperação
            const isConnected = await checkConnectionStatus(instance.instance_name, instance.api_key);
            if (!isConnected) {
              console.error('❌ WhatsApp ainda desconectado após recuperação!');
              await pauseCampaign(supabaseClient, campaign.id, 'Connection issues');
              break;
            }
            
            consecutiveErrors = 0; // Reset após pausa
            console.log('✅ Retomando envios...');
          }
        }

        // Delay inteligente entre mensagens com distribuição gaussiana
        if (i < clients.length - 1) {
          // Aplicar multiplicador de warm-up
          const warmupMultiplier = getWarmupMultiplier(i);
          const baseDelay = gaussianRandom(GAUSSIAN_MEAN, GAUSSIAN_STD_DEV);
          const finalDelay = Math.round(baseDelay * warmupMultiplier);
          
          if (warmupMultiplier > 1.0) {
            console.log(`🐢 Warm-up [${i + 1}]: ${finalDelay/1000}s (${warmupMultiplier}x mais lento)`);
          } else {
            console.log(`⏱️ Aguardando ${finalDelay/1000}s...`);
          }
          
          await sleep(finalDelay);
        }
      }

      // Finalizar campanha
      await supabaseClient
        .from('message_campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      console.log(`\n✅ Campanha finalizada!`);
      console.log(`📊 Resultado final: ${successCount} enviados | ${failedCount} falhas`);
    };

    // Iniciar processamento em background
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(backgroundTask());

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({ 
        success: true,
        campaign: campaign.id,
        message: `Campanha iniciada! ${clients.length} mensagens serão enviadas. Acompanhe o progresso no histórico.`,
        totalContacts: clients.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }
});
