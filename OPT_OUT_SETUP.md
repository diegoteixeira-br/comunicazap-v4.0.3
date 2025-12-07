# Configuração do Sistema de Opt-Out (Lista de Bloqueio)

## ⚠️ IMPORTANTE: Segurança dos Webhooks

Todos os endpoints de webhook agora exigem autenticação via token secreto. Você **DEVE** incluir o campo `secret` em todos os payloads enviados do n8n.

### Secret Token Necessário

O valor do `secret` deve ser o mesmo configurado no Lovable Cloud como `N8N_WEBHOOK_SECRET`.

**Endpoints que exigem o secret:**
- `process-opt-out` - Processa pedidos de saída
- `update-message-status` - Atualiza status de mensagens individuais
- `update-campaign-status` - Atualiza status da campanha

---

## Como Funciona

O sistema possui um endpoint que processa automaticamente quando um cliente pede para sair da lista de mensagens. Quando alguém responde com palavras como "NÃO", "SAIR", "PARAR", "CANCELAR", o número é adicionado à lista de bloqueio e não receberá mais mensagens.

---

## Configuração do n8n

### 1. Workflow "Receptor de Mensagens" - Opt-Out

No seu workflow do n8n que recebe os eventos `messages.upsert` da Evolution API, configure o HTTP Request para chamar o endpoint de opt-out.

#### Configurar o HTTP Request para Opt-Out

**Método:** POST

**URL:**
```
https://pxzvpnshhulrsjbeqqhn.supabase.co/functions/v1/process-opt-out
```

**Authentication:** None (usaremos header customizado)

**Headers:**

| Name | Value |
|------|-------|
| Content-Type | application/json |
| Authorization | Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4enZwbnNoaHVscnNqYmVxcWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDI4NjcsImV4cCI6MjA3NjAxODg2N30.c5RTN2Js4EWa0CyuopkXGZ7Q6JW7t6vKJhzlNmD5P9c |

**Body (JSON):**
```json
{
  "instanceName": "{{ $json.body.instance }}",
  "sender": "{{ $json.body.data.key.remoteJid }}",
  "message": "{{ $json.body.data.message.conversation || $json.body.data.message.extendedTextMessage?.text }}",
  "secret": "SEU_N8N_WEBHOOK_SECRET"
}
```

> ⚠️ **IMPORTANTE:** Substitua `SEU_N8N_WEBHOOK_SECRET` pelo valor real do seu secret configurado no Lovable Cloud.

---

### 2. Workflow "Callback de Status" - Update Message Status

Este endpoint é chamado pelo n8n após cada mensagem ser enviada para atualizar o status no banco de dados.

**Método:** POST

**URL:**
```
https://pxzvpnshhulrsjbeqqhn.supabase.co/functions/v1/update-message-status
```

**Headers:**

| Name | Value |
|------|-------|
| Content-Type | application/json |
| Authorization | Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4enZwbnNoaHVscnNqYmVxcWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDI4NjcsImV4cCI6MjA3NjAxODg2N30.c5RTN2Js4EWa0CyuopkXGZ7Q6JW7t6vKJhzlNmD5P9c |

**Body (JSON):**
```json
{
  "log_id": "{{ $json.log_id }}",
  "status": "sent",
  "campaign_id": "{{ $json.campaign_id }}",
  "error_message": null,
  "secret": "SEU_N8N_WEBHOOK_SECRET"
}
```

Para mensagens com erro:
```json
{
  "log_id": "{{ $json.log_id }}",
  "status": "failed",
  "campaign_id": "{{ $json.campaign_id }}",
  "error_message": "{{ $json.error }}",
  "secret": "SEU_N8N_WEBHOOK_SECRET"
}
```

---

### 3. Workflow "Finalização de Campanha" - Update Campaign Status

Este endpoint é chamado quando a campanha é finalizada.

**Método:** POST

**URL:**
```
https://pxzvpnshhulrsjbeqqhn.supabase.co/functions/v1/update-campaign-status
```

**Headers:**

| Name | Value |
|------|-------|
| Content-Type | application/json |
| Authorization | Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4enZwbnNoaHVscnNqYmVxcWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDI4NjcsImV4cCI6MjA3NjAxODg2N30.c5RTN2Js4EWa0CyuopkXGZ7Q6JW7t6vKJhzlNmD5P9c |

**Body (JSON):**
```json
{
  "campaign_id": "{{ $json.campaign_id }}",
  "status": "completed",
  "sent_count": {{ $json.sent_count }},
  "failed_count": {{ $json.failed_count }},
  "secret": "SEU_N8N_WEBHOOK_SECRET"
}
```

---

## Palavras que Acionam o Opt-Out

O sistema reconhece as seguintes palavras (case-insensitive) **mesmo dentro de frases ou com emojis**:
- não
- nao
- sair
- parar
- cancelar
- stop
- remover

**✅ Detecção Inteligente**: O sistema funciona mesmo se a palavra estiver em uma frase completa. Exemplos que funcionam:
- "❌ NÃO"
- "não quero mais"
- "PARAR por favor"
- "quero CANCELAR"

---

## Fluxo Completo

1. Cliente responde sua mensagem com "NÃO" ou "SAIR"
2. Evolution API envia evento `messages.upsert` para o n8n
3. n8n extrai os dados e chama o endpoint `process-opt-out` **com o campo secret**
4. O sistema verifica se a mensagem contém palavra de opt-out
5. Se sim, adiciona o número à tabela `blocked_contacts` do banco de dados
6. **Importante:** Nas próximas campanhas, o sistema automaticamente pula contatos bloqueados

---

## Verificação na Interface

### 👁️ Visualização na Tela de Nova Campanha

Após fazer opt-out, você verá o status dos contatos diretamente na interface:

- **📊 Contador no topo**: Mostra "X disponíveis, Y bloqueados"
- **🔴 Coluna "Bloqueio"**: Badge vermelho "🚫 Bloqueado" para contatos na blocklist
- **🟢 Badge verde** "✅ Disponível" para contatos que podem receber mensagens
- **Checkboxes desabilitados** para contatos bloqueados (não podem ser selecionados)
- **Filtro automático**: Contatos bloqueados são excluídos ao enviar campanhas
- **⚡ Atualização em tempo real**: Quando alguém faz opt-out, a lista atualiza instantaneamente

---

## Troubleshooting

### Erro 401 (Unauthorized) - Campo `secret` ausente ou incorreto

**Causa:** O campo `secret` não foi incluído no payload ou o valor está incorreto.

**Solução:**
1. Verifique se você adicionou o campo `secret` no Body JSON do n8n
2. Confirme que o valor do `secret` é EXATAMENTE igual ao configurado no Lovable Cloud
3. O secret é case-sensitive (diferencia maiúsculas de minúsculas)

### Erro 500 (Server Error) - N8N_WEBHOOK_SECRET não configurado

**Causa:** O secret não foi configurado no Lovable Cloud.

**Solução:**
1. Acesse o Lovable Cloud → Secrets
2. Adicione ou verifique o secret `N8N_WEBHOOK_SECRET`
3. Certifique-se de que o valor foi salvo corretamente

### O número não foi bloqueado

1. Verifique se o n8n está executando o workflow
2. Confira se os campos do JSON estão corretos (instanceName, sender, message, **secret**)
3. Verifique os logs da função `process-opt-out` no Lovable Cloud
4. Confirme que a palavra usada está na lista de opt-out

### Como verificar os logs

1. Acesse o Lovable Cloud (backend)
2. Vá em "Functions" → selecione a função desejada → "Logs"
3. Procure por mensagens como:
   - `"Opt-out detected, adding to blocked list"` (sucesso)
   - `"Invalid webhook secret provided"` (secret incorreto)

### Como remover um número da lista de bloqueio

1. Acesse o Lovable Cloud (backend)
2. Vá em "Database" → "blocked_contacts"
3. Encontre o registro do número
4. Clique em "Delete" (ícone de lixeira)

---

## Mensagens de Opt-in Recomendadas

Para seus clientes, sempre inclua uma opção de saída clara:

**Exemplo 1:**
```
Olá {nome}! 

Espero que esteja tudo bem com você!

Estamos atualizando nossa lista de contatos e gostaríamos de saber se você deseja continuar recebendo nossas mensagens.

Por favor, responda:
✅ SIM - para continuar recebendo
❌ NÃO - para não receber mais

Obrigado pela atenção! 🙏
```

**Exemplo 2:**
```
Oi {nome}! Você gostaria de continuar recebendo nossas mensagens? 

Responda SIM ou NÃO. Obrigado!
```

---

## Resumo: Checklist de Configuração

- [ ] Secret `N8N_WEBHOOK_SECRET` configurado no Lovable Cloud
- [ ] Campo `secret` adicionado no payload do `process-opt-out`
- [ ] Campo `secret` adicionado no payload do `update-message-status`
- [ ] Campo `secret` adicionado no payload do `update-campaign-status`
- [ ] Workflows do n8n testados e funcionando
