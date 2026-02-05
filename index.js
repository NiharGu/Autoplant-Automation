import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Pino from 'pino';
import { Boom } from '@hapi/boom';
import crypto from 'crypto';
import qrcode from 'qrcode-terminal'; // ✅ added
import { setupApKaraCommand } from './commands/ap-kara.js';

// Polyfill for crypto if needed
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = crypto;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Baileys as a CommonJS module via default
import baileysPkg from '@whiskeysockets/baileys';
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = baileysPkg;

// Logger setup
const logger = Pino({
  transport: {
    target: 'pino/file',
    options: { destination: path.join(__dirname, 'bot.log') },
  },
  level: 'info',
});

const consoleLogger = Pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  },
  level: 'info',
});

// Create auth directory if it doesn't exist
const authFolder = path.join(__dirname, 'auth');
if (!fs.existsSync(authFolder)) {
  fs.mkdirSync(authFolder, { recursive: true });
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: ['Ubuntu', 'Firefox', '22.04'],
  });

  setupApKaraCommand(sock);

  sock.ev.on('creds.update', saveCreds);

  // ✅ NEW: QR code handling
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('📷 Scan the QR code above to log in.');
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
          : true;

      console.error(`Connection closed: ${lastDisconnect?.error?.message || 'unknown error'}`);

      if (shouldReconnect) {
        console.log('Reconnecting...');
        startBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp! Monitoring "Test" group.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const senderJid = msg.key.remoteJid;

  // Only group chats
  if (!senderJid.endsWith('@g.us')) return;

  try {
    const groupMetadata = await sock.groupMetadata(senderJid);
    const groupName = groupMetadata.subject;

    if (groupName !== "Test") return;

    const participant = msg.key.participant;

    const formatPhoneNumber = (jid) => {
      if (!jid) return 'unknown';
      const numberPart = jid.split('@')[0];
      return numberPart.replace(/\D/g, '');
    };

    const senderNumber = participant
      ? formatPhoneNumber(participant)
      : formatPhoneNumber(senderJid);

    const sender = groupMetadata.participants.find(p => p.id === participant);
    const senderName = sender?.name || 'Unknown';

    const textMessage =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption;

    if (textMessage) {
      const logMessage = `📱 Message from ${senderName} (${senderNumber}): ${textMessage}`;
      console.log(logMessage);

      // !hi command (replying with quote using 3rd arg)
//      if (textMessage.toLowerCase().startsWith('!hi')) {
//        const name = textMessage.slice(3).trim();
//        let response;
//        if (name.length > 0) {
//          response = `Hi ${name} 👋`;
//        } else {
//          response = 'Hi 👋';
//        }
//        await sock.sendMessage(senderJid, { text: response }, { quoted: msg });
//        console.log(`✅ Replied to !hi with quote: "${response}"`);
//      }

//      else if (textMessage.toLowerCase().startsWith('!echo ')) {
//        const response = textMessage.slice(6);
//        await sock.sendMessage(senderJid, { text: response });
//        console.log(`✅ Replied with: ${response}`);
//      }

//      else if (textMessage.toLowerCase() === '!help') {
//        const helpText = `Available commands:
//- !hi [name] - Greet with a reply (quotes your message)
//- !echo [message] - Echo back your message
//- !help - Show this help message`;

//        await sock.sendMessage(senderJid, { text: helpText });
//        console.log('✅ Sent help message');
//      }
    }
  } catch (error) {
    logger.error(`Error processing message: ${error.message}`);
  }
}

);
}

// Error handling
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason}`);
  console.error('Unhandled promise rejection:', reason);
});

console.log('Starting WhatsApp Bot...');
startBot().catch(err => {
  console.error('Failed to start bot:', err.message);
});
