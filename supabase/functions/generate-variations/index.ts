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

    // Detectar se a mensagem original tem emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const hasEmojis = emojiRegex.test(originalMessage);
    const emojiCount = (originalMessage.match(emojiRegex) || []).length;

    // Sem limite máximo - calcular com base no número de contatos
    const variationCount = Math.max(1, count);
    const toGenerate = variationCount - 1; // Menos a original

    // Calcular distribuição 70/30 de emojis
    const withEmojiCount = hasEmojis 
      ? Math.round(toGenerate * 0.7)  // 70% com emojis se original tem
      : Math.round(toGenerate * 0.3); // 30% com emojis se original não tem
    const withoutEmojiCount = toGenerate - withEmojiCount;

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

      // Prompt melhorado: mensagens COMPLETAS e CRIATIVAS com separador
      const systemPrompt = `Você é um copywriter CRIATIVO para WhatsApp. Crie ${batchSize} mensagens COMPLETAS e CRIATIVAS.

⚠️ REGRA CRÍTICA DE FORMATO:
- Cada variação DEVE ser uma MENSAGEM COMPLETA
- Separe CADA variação com a linha: ---VARIACAO---
- NÃO numere as variações
- MANTENHA quebras de linha dentro de cada mensagem

📋 ESTRUTURA OBRIGATÓRIA DE CADA MENSAGEM (analise a original):
1. SAUDAÇÃO inicial (com {nome})
2. CORPO da mensagem (1-3 parágrafos)
3. DESPEDIDA/VOTOS
4. ASSINATURA (se tiver na original)

🎨 CRIATIVIDADE - Seja ORIGINAL e VARIADO:
- Use diferentes formas de expressar a mesma ideia
- Varie metáforas (novo ciclo, jornada, recomeço, etc.)
- Alterne entre abordagens (emocional, motivacional, calorosa, inspiradora)
- Mude a ordem dos elementos (agradecimento antes/depois)
- Use sinônimos criativos (parceria, confiança, caminhada juntos)
- Varie o comprimento das frases e parágrafos

${hasEmojis ? `
🎭 REGRAS DE EMOJIS (mensagem original TEM ${emojiCount} emoji(s)):
- Crie aproximadamente ${Math.round(batchSize * 0.7)} variações COM emojis:
  • Use emojis DIFERENTES mas na mesma pegada/temática da original
  • VARIE as posições (início, meio, fim da frase)
  • Pode usar emojis similares ou complementares
  • Mantenha a energia e tom visual da mensagem
  • Não repita os mesmos emojis da original sempre
  
- Crie aproximadamente ${Math.round(batchSize * 0.3)} variações SEM emojis:
  • Remova COMPLETAMENTE os emojis
  • Compense com palavras mais expressivas
  • Mantenha o mesmo entusiasmo só com texto
` : `
🎭 REGRAS DE EMOJIS (mensagem original NÃO tem emojis):
- Crie aproximadamente ${Math.round(batchSize * 0.7)} variações SEM emojis:
  • Mantenha o estilo clean e profissional
  • Use apenas texto, SEM emojis
  • Foco na clareza e objetividade
  
- Crie aproximadamente ${Math.round(batchSize * 0.3)} variações COM emojis sutis:
  • Adicione emojis apropriados ao contexto
  • Posicione em locais estratégicos (início ou fim)
  • Use emojis que combinem com o tom da mensagem
  • Não exagere - mantenha elegância
`}

${allVariations.length > 0 ? `
⚠️ VARIAÇÕES JÁ CRIADAS (NÃO REPETIR):
${allVariations.map((v, i) => `${i + 1}. ${v.substring(0, 100)}...`).join('\n')}

IMPORTANTE: As novas variações devem ser COMPLETAMENTE DIFERENTES das ${allVariations.length} acima!
` : ''}

✨ EXEMPLO DE FORMATO CORRETO (Mensagem de Ano Novo):

ORIGINAL:
✨ Olá, {nome}! ✨
Chegamos ao fim de mais um ano e queremos agradecer pela sua confiança!
Desejamos um final de ano repleto de momentos especiais.
Boas Festas e um próspero Ano Novo! 🎊
Com carinho, Equipe

SAÍDA ESPERADA:
🎆 Oi, {nome}! 🎆

Um novo ano está chegando e com ele milhões de possibilidades!

Obrigado por fazer parte da nossa história em mais esse ciclo. Sua confiança nos impulsiona a ser melhores a cada dia.

Que 2025 seja o ano das suas maiores conquistas! 🚀

Abraços calorosos,
Equipe
---VARIACAO---
Querido(a) {nome},

O ano está terminando e nosso coração transborda de gratidão por ter você conosco.

Cada momento de parceria foi especial e nos ensinou algo novo. Que venha um novo ano repleto de realizações e alegrias para você e toda sua família.

Feliz 2025!

Com muito carinho,
Equipe
---VARIACAO---
🌟 {nome}, tudo bem? 🌟

Fim de ano é tempo de olhar para trás e agradecer... E você faz parte das coisas boas que aconteceram!

Muito obrigado pela confiança e parceria durante todo esse ano.

Desejamos que o novo ano traga tudo de mais lindo para você! ✨

Um grande abraço,
Equipe
---VARIACAO---
Oi {nome},

Mais um ciclo se encerra e não poderíamos deixar passar sem expressar nossa gratidão.

Ter você conosco faz toda a diferença! Que o próximo ano seja ainda mais incrível, cheio de conquistas e momentos memoráveis.

Felizes Festas!

Atenciosamente,
Equipe

Retorne APENAS as ${batchSize} novas variações separadas por ---VARIACAO---`;

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

      // Processar as variações geradas usando o separador
      const batchVariations = generatedText
        .split('---VARIACAO---')
        .map((variation: string) => variation.trim())
        .filter((variation: string) => {
          // Validar que é uma mensagem completa
          const isLongEnough = variation.length > 50;
          const hasPlaceholder = variation.includes('{nome}');
          return isLongEnough && hasPlaceholder;
        })
        .slice(0, batchSize);

      // Se não conseguiu gerar todas, criar variações sutis (invisíveis para humanos)
      const subtleModifiers = [
        (msg: string) => msg.replace(/!$/, '.'),
        (msg: string) => msg.replace(/\.$/, '!'),
        (msg: string) => msg.trim() + ' ',
        (msg: string) => ' ' + msg.trim(),
        (msg: string) => msg.replace(/\n\n/g, '\n \n'),
        (msg: string) => msg.replace(/😊/g, '🙂'),
        (msg: string) => msg.replace(/🎉/g, '🎊'),
        (msg: string) => msg.replace(/✨/g, '⭐'),
        (msg: string) => msg.replace(/❤️/g, '💖'),
        (msg: string) => msg.replace(/👍/g, '👌'),
      ];
      
      while (batchVariations.length < batchSize) {
        const modifierIndex = (allVariations.length + batchVariations.length) % subtleModifiers.length;
        const modifier = subtleModifiers[modifierIndex];
        batchVariations.push(modifier(originalMessage));
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
