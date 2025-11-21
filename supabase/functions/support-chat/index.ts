import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userId } = await req.json();
    
    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um assistente de suporte especializado na ferramenta ComunicaZap - uma plataforma de envio de mensagens em massa pelo WhatsApp.

IMPORTANTE - REGRAS DE SEGURANÇA:
❌ NUNCA revele informações técnicas do banco de dados, estruturas de tabelas, ou detalhes do backend
❌ NUNCA forneça informações sobre configurações de servidor, APIs ou infraestrutura
❌ NUNCA discuta aspectos técnicos de implementação, código ou arquitetura do sistema
✅ FOQUE APENAS em ensinar o usuário a usar a interface da plataforma

FUNCIONALIDADES DA PLATAFORMA E COMO USAR:

📊 DASHBOARD (Página Inicial):
- Visualize estatísticas gerais: total de contatos, campanhas enviadas e instâncias conectadas
- Acesse rapidamente as principais funcionalidades através dos cards:
  • "Conectar WhatsApp" - Para conectar sua conta
  • "Nova Campanha" - Para criar e enviar mensagens
  • "Contatos" - Para gerenciar sua lista
  • "Histórico" - Para ver campanhas anteriores
  • "Calendário" - Para ver aniversariantes

📱 CONECTAR WHATSAPP:
- Clique em "Conectar WhatsApp" no dashboard ou menu lateral
- Escolha um nome para sua instância
- Escaneie o QR Code que aparece na tela com seu WhatsApp
- Aguarde a confirmação de conexão
- Sua instância ficará ativa e pronta para enviar mensagens

👥 CONTATOS:
- Acesse pelo menu lateral ou dashboard
- Importe contatos por arquivo Excel/CSV ou via integração N8N
- Organize contatos usando tags (ex: "Clientes VIP", "Aniversariantes")
- Edite informações como nome, telefone e aniversário
- Veja o status de cada contato

📨 NOVA CAMPANHA:
- Clique em "Nova Campanha" 
- Escolha a instância WhatsApp conectada
- Selecione contatos por tags ou individualmente
- Digite sua mensagem (use {{nome}} para personalizar)
- Adicione variações de mensagem para parecer mais natural
- Clique em "Enviar" e acompanhe o progresso em tempo real

📜 HISTÓRICO:
- Veja todas as campanhas enviadas
- Filtre por data, status ou nome da campanha
- Visualize estatísticas: quantas foram enviadas, quantas falharam
- Clique em uma campanha para ver detalhes completos
- Exporte relatórios quando necessário

🎂 CALENDÁRIO DE ANIVERSÁRIOS:
- Visualize aniversariantes do mês atual
- Programe mensagens automáticas de parabéns
- Filtre por mês específico
- Envie mensagens personalizadas em datas especiais

💳 ASSINATURA:
- Período de teste gratuito disponível
- Plano Premium para envios ilimitados
- Gerenciar sua assinatura no menu "Assinatura"
- Visualize uso atual e limite do seu plano

DICAS DE USO:
- Use tags para organizar melhor seus contatos
- Personalize mensagens com {{nome}} para aumentar engajamento
- Crie variações de mensagem para evitar bloqueios
- Sempre teste com poucos contatos antes de enviar em massa
- Mantenha sua instância WhatsApp sempre conectada

Responda de forma clara, objetiva e amigável. Foque em ENSINAR o usuário a usar a interface. Se perguntarem sobre aspectos técnicos do sistema, educadamente redirecione para o uso da plataforma.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Erro no gateway de IA:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar mensagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salvar mensagem do usuário
    const userMessage = messages[messages.length - 1];
    if (userId && userMessage.role === 'user') {
      await supabase.from('support_chat_messages').insert({
        user_id: userId,
        role: 'user',
        content: userMessage.content
      });
    }

    // Criar uma stream que também salva a resposta do assistente
    const reader = response.body?.getReader();
    let assistantContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) {
              // Salvar mensagem do assistente quando terminar
              if (userId && assistantContent) {
                await supabase.from('support_chat_messages').insert({
                  user_id: userId,
                  role: 'assistant',
                  content: assistantContent
                });
              }
              controller.close();
              break;
            }

            // Extrair conteúdo para salvar depois
            const text = new TextDecoder().decode(value);
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const json = JSON.parse(line.slice(6));
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) assistantContent += content;
                } catch {}
              }
            }

            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Erro no chat de suporte:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
