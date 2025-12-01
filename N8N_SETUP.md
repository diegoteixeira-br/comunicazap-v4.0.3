# Configuração do n8n para Integração com Evolution API

## ✅ Sistema Otimizado com Storage

O sistema agora **salva automaticamente** as imagens/vídeos no Supabase Storage e envia apenas a URL pública para o n8n. Isso resolve problemas de tamanho de payload e melhora a performance!

**Benefícios:**
- ✨ Sem limites de tamanho no webhook
- ⚡ Envios mais rápidos  
- 💾 Arquivos armazenados de forma organizada
- 🔒 URLs públicas seguras

---

## 📢 Suporte a Grupos do WhatsApp

O sistema agora suporta envio de mensagens para grupos do WhatsApp! 

**Como funciona:**
- Os grupos são buscados diretamente da sua conta WhatsApp conectada
- O ID do grupo termina com `@g.us` (ex: `120363123456789@g.us`)
- A Evolution API aceita IDs de grupo da mesma forma que números de contato
- **Nenhuma mudança é necessária no workflow do n8n** - os grupos funcionam automaticamente!

**Para o n8n:**
- Quando é um grupo, o campo `number` conterá o ID completo do grupo (ex: `120363123456789@g.us`)
- A Evolution API detecta automaticamente se é um grupo ou contato individual
- Use exatamente as mesmas configurações de HTTP Request descritas abaixo

---

## Formato do Payload Enviado pelo Sistema

O sistema envia o seguinte JSON para o webhook do n8n:

**Apenas Texto (COM SIMULAÇÃO DE DIGITAÇÃO):**
```json
{
  "instanceName": "user-82af4c91-1760496491812",
  "api_key": "EDA20E00-0647-4F30-B239-0D9B5C7FC193",
  "number": "556599999999",
  "text": "Olá João, sua mensagem aqui",
  "options": {
    "delay": 3500,
    "presence": "composing"
  }
}
```

**Com Imagem ou Vídeo (COM SIMULAÇÃO DE DIGITAÇÃO):**
```json
{
  "instanceName": "user-82af4c91-1760496491812",
  "api_key": "EDA20E00-0647-4F30-B239-0D9B5C7FC193",
  "number": "556599999999",
  "text": "Olá João, sua mensagem aqui",
  "mediaUrl": "https://pxzvpnshhulrsjbeqqhn.supabase.co/storage/v1/object/public/campaign-media/...",
  "mediaType": "image/png",
  "options": {
    "delay": 3500,
    "presence": "composing"
  }
}
```

**IMPORTANTE:** 
- ✅ **Novo:** Agora o sistema envia a **URL pública** do arquivo em vez de base64!
- 🤖 **NOVIDADE:** Sistema com **simulação de digitação humana**! O campo `options.delay` simula o tempo de digitação baseado no tamanho da mensagem
- 👤 **ANTI-BANIMENTO:** O campo `options.presence: "composing"` mostra o indicador "digitando..." para o destinatário antes de enviar
- O sistema suporta variações de mensagem! O campo `text` já vem personalizado.
- O sistema suporta imagens e vídeos até 50MB
- Quando há mídia, o campo `mediaUrl` contém a URL pública do arquivo no Supabase Storage
- O campo `mediaType` contém o tipo MIME correto (ex: `image/png`, `image/jpeg`, `video/mp4`)
- Para envios com mídia, você precisa usar o endpoint `/message/sendMedia/` ao invés de `/message/sendText/`

## Configuração do HTTP Request no n8n

### ⚠️ RECOMENDADO: Use um Nó IF para separar Texto e Mídia

O ideal é criar um workflow com um nó IF que verifica se há mídia:

1. **Webhook** (recebe o payload)
2. **IF** (verifica se `{{ $json.body.mediaUrl }}` existe)
   - Se SIM → vai para "HTTP Request - Enviar Mídia"
   - Se NÃO → vai para "HTTP Request - Enviar Texto"

### Configuração: HTTP Request - Enviar TEXTO (quando não há imagem)

#### 1. Método
- **POST**

#### 2. URL
```
http://evolution:8080/message/sendText/{{ $json.body.instanceName }}
```

#### 3. Authentication
- **None** (usaremos header customizado)

#### 4. Headers
| Name | Value |
|------|-------|
| apikey | `{{ $json.body.api_key }}` |

#### 5. Body (JSON)

**FORMATO ATUALIZADO - Agora com simulação de digitação e texto pré-escapado:**

```json
{
  "number": "{{ $json.body.number }}",
  "options": {
    "delay": {{ $json.body.options.delay }},
    "presence": "{{ $json.body.options.presence }}"
  },
  "textMessage": {
    "text": "{{ $json.body.text }}"
  }
}
```

**O que mudou:**
- ✅ Adicionado `options.delay` - simula tempo de digitação (calculado automaticamente pelo sistema)
- ✅ Adicionado `options.presence: "composing"` - mostra "digitando..." para o destinatário
- ✅ **NOVO:** O texto já vem **pré-escapado** do backend - não precisa mais de `.replace()` no n8n!
- ✅ Mensagem agora vai dentro de `textMessage.text` conforme API da Evolution
- ✅ **Importante:** Remova as aspas do `delay` (use `{{ $json.body.options.delay }}` sem aspas) para ser enviado como número

#### 6. Options
- Body Content Type: **application/json**

---

### Configuração: HTTP Request - Enviar MÍDIA (quando há imagem/vídeo)

#### 1. Método
- **POST**

#### 2. URL
```
http://evolution:8080/message/sendMedia/{{ $json.body.instanceName }}
```

#### 3. Authentication
- **None** (usaremos header customizado)

#### 4. Headers
| Name | Value |
|------|-------|
| apikey | `{{ $json.body.api_key }}` |

#### 5. Body (JSON)

**FORMATO ATUALIZADO - Com simulação de digitação, URL direta e texto pré-escapado:**

```json
{
  "number": "{{ $json.body.number }}",
  "options": {
    "delay": {{ $json.body.options.delay }},
    "presence": "{{ $json.body.options.presence }}"
  },
  "mediaMessage": {
    "mediatype": "image",
    "mimetype": "{{ $json.body.mediaType }}",
    "media": "{{ $json.body.mediaUrl }}",
    "caption": "{{ $json.body.text }}"
  }
}
```

**Explicação:**
- `options.delay`: Tempo de digitação simulado (calculado pelo sistema) - **SEM ASPAS** para ser número
- `options.presence`: Mostra "digitando..." antes de enviar
- `mediaMessage.mediatype`: Pode ser `"image"` ou `"video"` (use `"image"` que funciona para ambos)
- `mediaMessage.mimetype`: O tipo MIME correto do arquivo (ex: `image/png`, `image/jpeg`, `video/mp4`)
- `mediaMessage.media`: URL pública do arquivo no Supabase Storage
- `mediaMessage.caption`: O texto da mensagem - **já vem pré-escapado** do backend, não precisa de manipulação!
- ✅ **Vantagem:** Parece envio humano real com simulação de digitação!

#### 6. Options
- Body Content Type: **application/json**

---

### Configuração Alternativa (SE não quiser usar IF)

Se você não quiser usar o nó IF, configure apenas um HTTP Request que tenta enviar com ambos os formatos:

```json
{
  "number": "{{ $json.body.number }}",
  "options": {
    "delay": {{ $json.body.options.delay }},
    "presence": "{{ $json.body.options.presence }}"
  },
  "textMessage": {
    "text": "{{ $json.body.text }}"
  },
  "mediaMessage": {
    "mediatype": "{{ $json.body.mediaUrl ? 'image' : undefined }}",
    "mimetype": "{{ $json.body.mediaType }}",
    "media": "{{ $json.body.mediaUrl }}",
    "caption": "{{ $json.body.text }}"
  }
}
```

**ATENÇÃO:** 
- Esta configuração pode não funcionar bem. Por isso, **recomendamos fortemente usar o nó IF**.
- Note que `delay` não tem aspas - deve ser enviado como número para a Evolution API

## Sistema de Variações de Mensagem

### Como Funciona:

1. O usuário cria até 3 variações diferentes da mesma mensagem no frontend
2. O sistema alterna automaticamente entre as variações:
   - Cliente 1 → Variação 1
   - Cliente 2 → Variação 2
   - Cliente 3 → Variação 3
   - Cliente 4 → Variação 1 (volta ao início)
   - E assim por diante...
3. O campo `text` já chega no n8n com a variação correta e personalizada

### Por que usar variações?

- **Anti-Banimento:** Evita que o WhatsApp detecte envio da mesma mensagem repetidas vezes
- **Parece mais humano:** Cada cliente recebe uma mensagem ligeiramente diferente
- **Automático:** O sistema gerencia tudo, você só configura uma vez no n8n

---

## 🤖 Sistema de Simulação de Comportamento Humano

### O que o sistema faz automaticamente:

#### 1. **Simulação de Digitação Real**
- Calcula o tempo de digitação baseado no **tamanho da mensagem** (200 caracteres/min)
- Mostra o indicador "**digitando...**" para o destinatário antes de enviar
- Mensagens mais longas levam mais tempo para "digitar"

#### 2. **Delays com Distribuição Gaussiana**
- Em vez de delays uniformes, usa **distribuição normal** (média 8s, desvio 3s)
- Parece mais humano: maioria 5-11s, ocasionalmente 2s ou 14s
- Imita o comportamento irregular de envio manual

#### 3. **Warm-up Gradual**
- **Primeiras 3 mensagens:** 3x mais lentas (24s entre msgs)
- **Próximas 3 mensagens:** 2x mais lentas (16s entre msgs)
- **Próximas 4 mensagens:** 1.5x mais lentas (12s entre msgs)
- **Após 10ª mensagem:** velocidade normal (8s ± 3s)
- **Por quê?** Humanos começam devagar e aumentam a velocidade gradualmente

#### 4. **Pausas Aleatórias "Humanas"**
- **10% de chance:** pausa curta de 30s a 2min (como ir ao banheiro)
- **5% de chance:** pausa longa de 2 a 5min (como atender telefone)
- Imita distrações naturais durante envio manual

#### 5. **Lotes Irregulares**
- Tamanho de lote **variável**: 8 a 15 mensagens (não fixo)
- Pausa de lote também **variável**: 1.5 a 3 minutos
- Próximo lote sempre tem tamanho diferente
- **Por quê?** Humanos não enviam sempre o mesmo número de mensagens antes de pausar

### Resultado:

✅ **WhatsApp não detecta automação** - parece envio 100% manual  
✅ **Indicador "digitando..."** aparece naturalmente  
✅ **Padrões irregulares** como humano real  
✅ **Velocidade aumenta gradualmente** após warm-up  
✅ **Pausas aleatórias** simulam comportamento natural  

**IMPORTANTE:** Todos esses comportamentos são **automáticos**! Você só precisa configurar o n8n uma vez e o sistema cuida de tudo.

## Sistema de Bloqueio (Opt-Out)

O sistema agora possui proteção contra banimento através de lista de bloqueio. Veja o arquivo `OPT_OUT_SETUP.md` para configurar o webhook que processa quando clientes pedem para sair.

## Verificação

Após configurar, teste com o seguinte payload de exemplo:

```json
{
  "instanceName": "user-test-123",
  "api_key": "sua-api-key-aqui",
  "number": "5565999999999",
  "text": "Mensagem de teste"
}
```

## Troubleshooting

### Erro ao fazer upload de mídia

**Problema:** Falha ao salvar arquivo no Supabase Storage

**Solução:** 
1. Verifique se o bucket "campaign-media" existe no Supabase
2. Confirme que o bucket está configurado como público
3. Verifique os logs da edge function para mais detalhes

### Erro 400 "Bad Request - instance requires property 'text'"

Isso acontece quando o formato do body JSON não está correto. Verifique:

1. O formato do body está **exatamente** como especificado acima
2. Os campos `number` e `text` estão no nível correto do JSON
3. Não há campos extras ou faltando

### Erro 401 "Unauthorized"

Isso acontece quando a apikey não está correta:

1. Verifique se o header `apikey` está configurado
2. Verifique se está usando `{{ $json.body.api_key }}` corretamente
3. Confirme que a api_key no banco de dados está correta

### Teste Manual da Evolution API

Você pode testar diretamente com curl:

```bash
curl -X POST \
  http://evolution:8080/message/sendText/user-82af4c91-1760496491812 \
  -H 'apikey: EDA20E00-0647-4F30-B239-0D9B5C7FC193' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5565999999999",
    "text": "Teste de mensagem"
  }'
```

## Formato Alternativo (se o primeiro não funcionar)

Caso a Evolution API exija um formato diferente, tente:

```json
{
  "number": "{{ $json.body.number }}",
  "options": {
    "delay": 1200,
    "presence": "composing"
  },
  "textMessage": {
    "text": "{{ $json.body.text }}"
  }
}
```
