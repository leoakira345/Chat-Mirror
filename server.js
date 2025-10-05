// server.js - lightweight Node/Express backend for the Mirror frontend
// - Serves static frontend from ./public
// - Exposes /api/init, /api/profile, /api/chats/:chatId, /api/chats/:chatId/messages, /api/chats/:chatId/files
// - Handles file uploads via multer and stores in ./uploads (served statically at /uploads)

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Static for uploads (files attached in chats)
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Static for frontend (public folder with index.html, app.js, styles.css, etc)
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const unique = Date.now() + '-' + Math.floor(Math.random() * 1e9);
    cb(null, base + '-' + unique + ext);
  }
});
const upload = multer({ storage });

// In-memory mock data to support frontend flows
let dataStore = {
  user: { id: '100001', name: 'You', about: '', phone: '' },
  contacts: [
    { id: '200001', name: 'Alex Chen' },
    { id: '200002', name: 'Priya Patel' },
    { id: '300001', name: 'Luis Martinez' },
    { id: '300002', name: 'Emma Rossi' }
  ],
  chats: [
    // Example chat shape (optional pre-seed)
    // {
    //   id: 'c1001',
    //   name: 'Alex Chen',
    //   time: '12:34',
    //   lastMessage: 'Hi!',
    //   messages: [{ text: 'Hi', type: 'sent', time: '12:33' }]
    // }
  ]
};

// Helpers
function generateChatId() {
  const base = (dataStore.chats?.length || 0) + 1;
  return 'c' + (1000 + base + Math.floor(Math.random() * 900)).toString().slice(-4);
}
function findChat(chatId) {
  return dataStore.chats.find(c => c.id === chatId);
}
function currentUserId(){ return dataStore.user?.id || '100001'; }

// Routes

// Initialization data (frontend calls /api/init on startup)
app.get('/api/init', (req, res) => {
  res.json({
    user: dataStore.user,
    contacts: dataStore.contacts,
    chats: dataStore.chats
  });
});

// Update / save profile
app.post('/api/profile', (req, res) => {
  const updated = Object.assign({}, dataStore.user, req.body || {});
  dataStore.user = updated;
  res.json({ user: updated });
});

// Get a specific chat
app.get('/api/chats/:chatId', (req, res) => {
  const chatId = req.params.chatId;
  const chat = findChat(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  res.json(chat);
});

// Post a new message to a chat
app.post('/api/chats/:chatId/messages', (req, res) => {
  const chatId = req.params.chatId;
  const { text, type } = req.body || {};
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let chat = findChat(chatId);
  if (!chat) {
    // Create a new chat stub if it doesn't exist yet
    chat = { id: chatId, name: 'Chat', time, lastMessage: text || '', messages: [] };
    dataStore.chats.push(chat);
  }

  chat.messages = chat.messages || [];
  chat.messages.push({ text: text || '', type: type || 'sent', time });
  chat.lastMessage = text || '';
  chat.time = time;

  res.json({ ok: true });
});

// Upload a file attached to a chat
app.post('/api/chats/:chatId/files', upload.single('file'), (req, res) => {
  const chatId = req.params.chatId;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const isImage = /^image\//.test(file.mimetype || '');
  const fileUrl = '/uploads/' + file.filename;

  res.json({ fileUrl, isImage, fileName: file.originalname });
});

// Optional helper: start a new chat (not strictly required by the frontend)
app.post('/api/start-chat', (req, res) => {
  const { name } = req.body || {};
  const chatId = generateChatId();
  const chat = {
    id: chatId,
    name: name || 'New Chat',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    lastMessage: 'Chat started.',
    messages: []
  };
  dataStore.chats.push(chat);
  res.json(chat);
});

// Fallback: root route to ensure single-page app works if opened directly
app.get((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
