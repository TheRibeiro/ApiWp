import 'dotenv/config';
import express from 'express';
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

// ============================================
// CONFIGURATION
// ============================================
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.X_API_KEY || 'your-secret-api-key';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key for backend
const SESSION_ID = 'main';

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Logger
const logger = pino({ level: 'info' });

// ============================================
// WHATSAPP CONNECTION
// ============================================
let sock = null;
let isConnected = false;

// Supabase-based auth state
const useSupabaseAuthState = async () => {
    const saveState = async (state) => {
        try {
            const { error } = await supabase
                .from('whatsapp_auth')
                .upsert({
                    session_id: SESSION_ID,
                    auth_state: state
                }, {
                    onConflict: 'session_id'
                });

            if (error) throw error;
            logger.info('✅ Auth state saved to Supabase');
        } catch (error) {
            logger.error('❌ Error saving auth state:', error.message);
        }
    };

    const loadState = async () => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_auth')
                .select('auth_state')
                .eq('session_id', SESSION_ID)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No data found, return empty state
                    logger.info('📝 No existing auth state found, starting fresh');
                    return { creds: null, keys: null };
                }
                throw error;
            }

            logger.info('✅ Auth state loaded from Supabase');
            return data.auth_state || { creds: null, keys: null };
        } catch (error) {
            logger.error('❌ Error loading auth state:', error.message);
            return { creds: null, keys: null };
        }
    };

    const state = await loadState();

    return {
        state: {
            creds: state.creds || {},
            keys: state.keys || {}
        },
        saveCreds: async () => {
            await saveState({
                creds: sock.authState.creds,
                keys: sock.authState.keys
            });
        }
    };
};

// Connect to WhatsApp
async function connectToWhatsApp() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useSupabaseAuthState();

        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }), // Reduce noise
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            getMessage: async () => ({ conversation: 'RachaAI Bot' })
        });

        // Connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Log full update for debugging
            logger.info('Connection update:', { connection, hasQR: !!qr });

            if (qr) {
                logger.info('📱 QR Code generated - Scan with WhatsApp');
                logger.info('QR Code:');
                console.log('\n'); // Add spacing
                qrcode.generate(qr, { small: true });
                console.log('\n'); // Add spacing
                logger.info('Scan the QR code above with WhatsApp');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message;

                logger.error('Connection closed:', {
                    statusCode,
                    errorMessage,
                    shouldReconnect: statusCode !== DisconnectReason.loggedOut
                });

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    logger.info('Reconnecting in 5 seconds...');
                    setTimeout(() => connectToWhatsApp(), 5000);
                } else {
                    isConnected = false;
                    logger.error('❌ Logged out. Please restart and scan QR code again.');
                }
            } else if (connection === 'open') {
                isConnected = true;
                logger.info('✅ WhatsApp connected successfully!');
            } else if (connection === 'connecting') {
                logger.info('🔄 Connecting to WhatsApp...');
            }
        });

        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        logger.error('❌ Error connecting to WhatsApp:', error.message);
        setTimeout(() => connectToWhatsApp(), 10000);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format phone number to international format
function formatPhoneNumber(number) {
    // Remove all non-digits
    let cleaned = number.replace(/\D/g, '');

    // If starts with 0, remove it
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // If doesn't start with country code, add Brazil (55)
    if (!cleaned.startsWith('55')) {
        cleaned = '55' + cleaned;
    }

    // Add WhatsApp suffix
    return cleaned + '@s.whatsapp.net';
}

// Random delay to avoid spam detection
function randomDelay(min = 1000, max = 3000) {
    return new Promise(resolve =>
        setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
    );
}

// Send WhatsApp message
async function sendWhatsAppMessage(number, message) {
    if (!isConnected || !sock) {
        throw new Error('WhatsApp not connected');
    }

    const formattedNumber = formatPhoneNumber(number);

    await randomDelay(); // Anti-spam delay

    await sock.sendMessage(formattedNumber, { text: message });
    logger.info(`📤 Message sent to ${number}`);
}

// ============================================
// EXPRESS SERVER
// ============================================
const app = express();
app.use(express.json());

// API Key middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized - Invalid API Key'
        });
    }

    next();
};

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        connected: isConnected,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ENDPOINT: Send OTP
// ============================================
app.post('/v1/send-otp', validateApiKey, async (req, res) => {
    try {
        const { number, code } = req.body;

        if (!number || !code) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: number, code'
            });
        }

        const message = `🔐 *RachaAI*\n\nSeu código de ativação é: *${code}*\n\nUtilize-o para validar sua conta agora.`;

        await sendWhatsAppMessage(number, message);

        res.json({
            success: true,
            message: 'OTP sent successfully',
            number: formatPhoneNumber(number)
        });

    } catch (error) {
        logger.error('❌ Error sending OTP:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ENDPOINT: Notify Billing
// ============================================
app.post('/v1/notify-billing', validateApiKey, async (req, res) => {
    try {
        const { number, type, service, value, pixKey } = req.body;

        if (!number || !type || !service || !value || !pixKey) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: number, type, service, value, pixKey'
            });
        }

        let message = '';

        switch (type) {
            case 'D-1':
                message = `👋 Olá!\n\nSua parte da assinatura *${service}* vence amanhã.\n\n💰 Valor: R$ ${value}\n🔑 Chave Pix: \`${pixKey}\`\n\nPague agora e evite transtornos!`;
                break;

            case 'D0':
                message = `⚠️ *Atenção!*\n\nSua fatura do *${service}* vence *HOJE*.\n\nEvite a interrupção do serviço!\n\n💰 Valor: R$ ${value}\n🔑 Chave Pix: \`${pixKey}\``;
                break;

            case 'D+1':
                message = `🚨 *PAGAMENTO ATRASADO*\n\nSua assinatura do *${service}* venceu ontem.\n\nO dono do grupo já foi notificado.\n\n💰 Valor: R$ ${value}\n🔑 Chave Pix: \`${pixKey}\`\n\nRegularize agora para manter o acesso!`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid type. Use: D-1, D0, or D+1'
                });
        }

        await sendWhatsAppMessage(number, message);

        res.json({
            success: true,
            message: 'Billing notification sent successfully',
            type,
            number: formatPhoneNumber(number)
        });

    } catch (error) {
        logger.error('❌ Error sending billing notification:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, async () => {
    logger.info(`🚀 WhatsApp Microservice running on port ${PORT}`);
    logger.info(`🔐 API Key protection enabled`);
    logger.info(`📱 Connecting to WhatsApp...`);

    await connectToWhatsApp();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('👋 Shutting down gracefully...');
    if (sock) {
        await sock.logout();
    }
    process.exit(0);
});
