const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Client, GatewayIntentBits } = require('discord.js');

// 1. Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 2. Setup Express App
const app = express();
app.use(cors());
app.use(express.json());

const activeBots = {};

/* ============================================================
   INTERNAL BOT (VoxBot)
   ============================================================ */
app.post('/api/bot', async (req, res) => {
    const { text, sender, groupId, serverId, channel } = req.body;
    let reply = null;
    if (text.toLowerCase().includes('hello')) reply = `Hello ${sender}! I am VoxBot 🤖`;

    if (reply) {
        const msgData = { sender: 'VoxBot 🤖', senderUid: 'bot', text: reply, timestamp: admin.firestore.FieldValue.serverTimestamp() };
        if (groupId) msgData.groupId = groupId;
        if (serverId) { msgData.serverId = serverId; msgData.channel = channel; }
        await db.collection('vox_messages').add(msgData);
    }
    res.status(200).send('OK');
});

/* ============================================================
   INCOMING WEBHOOK (For 3rd Party Bots / Hacker Bot)
   ============================================================ */
app.post('/api/incoming-webhook', async (req, res) => {
    const { text, sender, secret, serverId, channel } = req.body;

    if (secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).send('Unauthorized: Wrong secret password');
    }
    if (!text || !serverId || !channel) {
        return res.status(400).send('Missing text, serverId, or channel');
    }
    try {
        await db.collection('vox_messages').add({
            sender: sender || 'External Bot 🤖',
            senderUid: 'external_bot',
            senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=External',
            text: text,
            serverId: serverId,
            channel: channel,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(200).send('Message sent to Vox! 🚀');
    } catch (error) {
        console.error(error);
        res.status(500).send('Database error');
    }
});

/* ============================================================
   THE DISCORD BRIDGE FUNCTION
   ============================================================ */
async function startDiscordBridge(token, serverId, channelId) {
    if (!token || !serverId || !channelId) return;

    const discordBot = new Client({ 
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
    });

    discordBot.on('ready', () => {
        console.log(`✅ Auto-Bridge logged in as ${discordBot.user.tag}! Listening to Discord...`);
    });

    discordBot.on('messageCreate', async message => {
        if (message.author.bot) return; 
        try {
            await db.collection('vox_messages').add({
                sender: `🤖 ${message.author.username} (Discord)`,
                senderUid: 'discord_import',
                senderPhoto: message.author.displayAvatarURL(),
                text: message.content,
                serverId: serverId,
                channel: channelId,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) { console.error("Bridge error:", err); }
    });

    await discordBot.login(token);
    activeBots[token] = discordBot;
}

/* ============================================================
   IMPORT DISCORD BOT (Manual trigger from Vox UI)
   ============================================================ */
app.post('/api/import-discord-bot', async (req, res) => {
    const { botToken, voxServerId, voxChannelId } = req.body;

    if (!botToken || !voxServerId || !voxChannelId) {
        return res.status(400).send('Missing botToken, voxServerId, or voxChannelId');
    }

    try {
        await startDiscordBridge(botToken, voxServerId, voxChannelId);
        res.status(200).send(`Successfully imported Discord bot!`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to import bot. Check if the token is correct.');
    }
});

/* ============================================================
   AUTO-START ON BOOT (Checks Environment Variables)
   ============================================================ */
if (process.env.DISCORD_TOKEN && process.env.VOX_BRIDGE_SERVER_ID && process.env.VOX_BRIDGE_CHANNEL_ID) {
    console.log("Found Discord environment variables. Starting auto-bridge...");
    startDiscordBridge(process.env.DISCORD_TOKEN, process.env.VOX_BRIDGE_SERVER_ID, process.env.VOX_BRIDGE_CHANNEL_ID);
} else {
    console.log("No Discord auto-bridge environment variables found. Waiting for manual import.");
}

/* ============================================================
   START SERVER
   ============================================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
