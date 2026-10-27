const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

/* ============================================================
   1. INTERNAL BOT (The one you tested earlier)
   ============================================================ */
app.post('/api/bot', async (req, res) => {
    const { text, sender, groupId, serverId, channel } = req.body;

    let reply = null;
    const lowerText = text.toLowerCase();

    if (lowerText.includes('hello') || lowerText.includes('hi')) {
        reply = `Hello ${sender}! I am VoxBot 🤖`;
    } else if (lowerText === '/ping') {
        reply = 'Pong! 🏓';
    } else if (lowerText === '/joke') {
        reply = 'Why do programmers prefer dark mode? Because light attracts bugs! 🐛';
    }

    if (reply) {
        const msgData = {
            sender: 'VoxBot 🤖',
            senderUid: 'bot',
            senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=VoxBot',
            text: reply,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        if (groupId) msgData.groupId = groupId;
        if (serverId) { msgData.serverId = serverId; msgData.channel = channel; }

        await db.collection('vox_messages').add(msgData);
    }

    res.status(200).send('OK');
});

/* ============================================================
   2. INCOMING WEBHOOK (For 3rd Party Bots)
   ============================================================ */
app.post('/api/incoming-webhook', async (req, res) => {
    const { text, sender, secret, serverId, channel } = req.body;

    // 1. Check the secret password!
    if (secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).send('Unauthorized: Wrong secret password');
    }

    if (!text || !serverId || !channel) {
        return res.status(400).send('Missing text, serverId, or channel');
    }

    try {
        // 2. Write the external message directly to Vox Firestore
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
