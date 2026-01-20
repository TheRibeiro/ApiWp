# RachaAI - WhatsApp Microservice 📱

Microserviço ultra-leve para envio de mensagens WhatsApp usando Baileys com persistência no Supabase.

## 🚀 Características

- ✅ Conexão persistente com WhatsApp (sessão salva no Supabase)
- ✅ Não precisa escanear QR Code a cada deploy
- ✅ Ultra-leve para rodar em instâncias gratuitas (Render/Koyeb)
- ✅ API REST protegida com X-API-KEY
- ✅ Delay aleatório anti-spam
- ✅ Reconexão automática

## 📋 Pré-requisitos

1. Node.js 18+ instalado
2. Conta no Supabase
3. Número de WhatsApp para conectar

## 🛠️ Instalação

### 1. Instalar dependências

```bash
cd whatsapp-microservice
npm install
```

### 2. Configurar Supabase

Execute o SQL no **Supabase SQL Editor**:

```sql
-- Cole o conteúdo do arquivo supabase-schema.sql
```

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

```env
PORT=3000
X_API_KEY=minha-chave-secreta-super-segura
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-role-key
```

⚠️ **IMPORTANTE:** Use a **Service Role Key** do Supabase, não a Anon Key!

### 4. Iniciar o servidor

```bash
npm start
```

### 5. Escanear QR Code

Na primeira vez, um QR Code aparecerá no terminal. Escaneie com WhatsApp:

1. Abra WhatsApp no celular
2. Vá em **Configurações** > **Aparelhos conectados**
3. Toque em **Conectar um aparelho**
4. Escaneie o QR Code

✅ A sessão será salva no Supabase automaticamente!

## 📡 Endpoints

### Health Check

```http
GET /health
```

**Resposta:**
```json
{
  "success": true,
  "connected": true,
  "timestamp": "2026-01-20T14:00:00.000Z"
}
```

### 1. Enviar OTP (Cadastro)

```http
POST /v1/send-otp
X-API-Key: sua-chave-aqui
Content-Type: application/json

{
  "number": "11999999999",
  "code": "123456"
}
```

**Mensagem enviada:**
```
🔐 RachaAI

Seu código de ativação é: 123456

Utilize-o para validar sua conta agora.
```

### 2. Notificar Cobrança

```http
POST /v1/notify-billing
X-API-Key: sua-chave-aqui
Content-Type: application/json

{
  "number": "11999999999",
  "type": "D-1",
  "service": "Netflix Premium",
  "value": "14.90",
  "pixKey": "email@exemplo.com"
}
```

**Tipos disponíveis:**
- `D-1`: Vence amanhã
- `D0`: Vence hoje
- `D+1`: Vencido (atrasado)

## 🚀 Deploy

### Render.com

1. Crie um novo **Web Service**
2. Conecte seu repositório
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Adicione as variáveis de ambiente
5. Deploy!

### Koyeb

1. Crie um novo **App**
2. Selecione **GitHub**
3. Configure:
   - **Build:** `npm install`
   - **Run:** `npm start`
4. Adicione as variáveis de ambiente
5. Deploy!

⚠️ **IMPORTANTE:** Após o primeiro deploy, acesse os logs e escaneie o QR Code!

## 🔗 Integração com RachaAI

Veja o arquivo `integration-example.js` para exemplos de como chamar o microserviço do seu projeto principal.

## 🐛 Troubleshooting

### QR Code não aparece
- Verifique se `printQRInTerminal: true` está configurado
- Acesse os logs do servidor

### Desconecta após deploy
- Certifique-se de que a sessão está sendo salva no Supabase
- Verifique as permissões da tabela `whatsapp_auth`

### Erro "WhatsApp not connected"
- Aguarde alguns segundos após o deploy
- Verifique o endpoint `/health` para ver o status

### Mensagens não chegam
- Verifique se o número está no formato correto
- Teste com seu próprio número primeiro
- Verifique os logs para erros

## 📝 Logs

O microserviço usa `pino` para logging. Principais eventos:

- ✅ `WhatsApp connected successfully!` - Conectado
- 📱 `QR Code generated` - QR Code disponível
- 📤 `Message sent to...` - Mensagem enviada
- ⚠️ `Connection closed` - Desconectado
- ❌ Erros diversos

## 🔒 Segurança

- ✅ API protegida com X-API-KEY
- ✅ Validação de campos obrigatórios
- ✅ Delay aleatório anti-spam
- ✅ Logs sem informações sensíveis

## 📄 Licença

MIT
