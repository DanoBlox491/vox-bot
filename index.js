const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin
// We will use an environment variable for security
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/bot', async (req, res) => {
    const { text, sender, groupId, serverId, channel } = req.body;

    // 1. Bot Logic (You can change this!)
    let reply = null;
    const lowerText = text.toLowerCase();

    if (lowerText.includes('hello') || lowerText.includes('hi')) {
        reply = `Hello ${sender}! I am VoxBot 🤖`;
    } else if (lowerText === '/ping') {
        reply = 'Pong! 🏓';
    } else if (lowerText === '/joke') {
        reply = 'Why do programmers prefer dark mode? Because light attracts bugs! 🐛';
    }

    // 2. If the bot wants to reply, write to Firestore
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));