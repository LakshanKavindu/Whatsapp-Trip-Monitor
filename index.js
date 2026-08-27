const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const notifier = require("node-notifier");
const qrcode = require("qrcode-terminal");
const config = require("./config");

const logger = pino({ level: "silent" }); // set to "info" if you want verbose logs

let lastNotifiedAt = 0;

function extractText(message) {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ""
  );
}

function messageMatches(text) {
  if (!config.requireMatch) return true;
  const lower = text.toLowerCase();

  const keywordHit = config.keywords.some((kw) =>
    lower.includes(kw.toLowerCase())
  );
  if (keywordHit) return true;

  const regexHit = config.regexPatterns.some((re) => re.test(text));
  return regexHit;
}

function notify(groupName, sender, text) {
  const now = Date.now();
  if (now - lastNotifiedAt < config.notificationCooldownMs) return;
  lastNotifiedAt = now;

  notifier.notify({
    title: `Trip alert — ${groupName}`,
    message: `${sender}: ${text}`.slice(0, 250),
    sound: true,
    wait: false,
  });

  console.log(`[MATCH] (${groupName}) ${sender}: ${text}`);
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_state");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false, // we handle QR display ourselves below
    auth: state,
    // Read-only intent: we never call sock.sendMessage anywhere in this file.
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nScan this QR code with WhatsApp (Linked Devices):\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        `Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`
      );
      if (shouldReconnect) {
        startBot();
      } else {
        console.log(
          "Logged out. Delete the auth_state folder and restart to re-link."
        );
      }
    } else if (connection === "open") {
      console.log("Connected. Listening for group messages...\n");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid || "";
      const isGroup = jid.endsWith("@g.us");
      if (!isGroup) continue; // this bot only watches group chats

      // Uncomment to discover group JIDs for config.watchedGroupIds:
      // console.log("Group JID:", jid);

      if (
        config.watchedGroupIds.length > 0 &&
        !config.watchedGroupIds.includes(jid)
      ) {
        continue;
      }

      const text = extractText(msg.message);
      if (!text) continue;

      if (messageMatches(text)) {
        const groupMeta = await sock.groupMetadata(jid).catch(() => null);
        const groupName = groupMeta?.subject || jid;
        const sender = msg.pushName || "Unknown";
        notify(groupName, sender, text);
      }
    }
  });
}

startBot().catch((err) => {
  console.error("Fatal error starting bot:", err);
});
