import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PER_BATCH = 10; // IA gera bem até 10 variações por vez

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

    const { originalMessage, count = 3 } = await req.json();

    if (!originalMessage || !originalMessage.trim()) {
      throw new Error('Original message is required');
    }

    // Sem limite máximo - calcular com base no número de contatos
    const variationCount = Math.max(1, count);
    const toGenerate = variationCount - 1; // Menos a original

    if (toGenerate === 0) {
      // Se só precisa de 1, retornar apenas a original
      return new Response(
        JSON.stringify({ 
          success: true,
          variations: [originalMessage]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Generating ${toGenerate} variations for user ${user.id}`);

    // Dividir em lotes para evitar sobrecarregar a IA
    const totalBatches = Math.ceil(toGenerate / MAX_PER_BATCH);
    const allVariations: string[] = [];

    for (let batch = 0; batch < totalBatches; batch++) {
      const isLastBatch = batch === totalBatches - 1;
      const batchSize = isLastBatch 
        ? toGenerate - (batch * MAX_PER_BATCH)
        : MAX_PER_BATCH;

      console.log(`Generating batch ${batch + 1}/${totalBatches} with ${batchSize} variations`);

      // Prompt melhorado para evitar repetições
      const systemPrompt = `Você é um especialista em copywriting para WhatsApp. Sua tarefa é criar ${batchSize} variações ÚNICAS de mensagens.

REGRAS OBRIGATÓRIAS:
- Cada variação deve ser COMPLETAMENTE diferente das anteriores
- Use sinônimos, reorganize frases, mude a abordagem
- Mantenha o mesmo significado e propósito da mensagem original
- O mesmo tom (formal/informal/vendas/amigável)
- Placeholders como {nome} devem ser preservados EXATAMENTE
- Tamanho similar à mensagem original
- Emojis apenas se a original tiver (mantenha o estilo)
- Linguagem natural e brasileira

${allVariations.length > 0 ? `
VARIAÇÕES JÁ CRIADAS (NÃO REPETIR):
${allVariations.map((v, i) => `${i + 1}. ${v}`).join('\n')}

IMPORTANTE: As novas variações devem ser DIFERENTES das ${allVariations.length} acima!
` : ''}

Retorne APENAS as ${batchSize} novas variações, uma por linha, sem numeração ou prefixos.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Mensagem original:\n\n${originalMessage}\n\nCrie ${batchSize} variações ÚNICAS e DIFERENTES.` }
          ],
          temperature: 0.9, // Mais criatividade para evitar repetições
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Limite de taxa excedido. Tente novamente em alguns instantes.');
        }
        if (response.status === 402) {
          throw new Error('Créditos insuficientes. Adicione créditos à sua conta Lovable.');
        }
        const errorText = await response.text();
        console.error('Lovable AI error:', response.status, errorText);
        throw new Error('Erro ao gerar variações com IA');
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content;

      if (!generatedText) {
        throw new Error('No content generated');
      }

      // Processar as variações geradas
      const batchVariations = generatedText
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .slice(0, batchSize);

      // Se não conseguiu gerar todas, preencher com modificações da original
      while (batchVariations.length < batchSize) {
        batchVariations.push(`${originalMessage} (variação ${allVariations.length + batchVariations.length + 1})`);
      }

      allVariations.push(...batchVariations);
      
      console.log(`Batch ${batch + 1} complete: ${batchVariations.length} variations generated`);
    }

    console.log(`Total generated: ${allVariations.length} variations (requested: ${toGenerate})`);

    return new Response(
      JSON.stringify({ 
        success: true,
        variations: [originalMessage, ...allVariations] // Original + variações
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-variations:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
