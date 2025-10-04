// server.js
require('dotenv').config();
console.log("server.js has started");
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const InstagramStrategy = require('passport-instagram').Strategy; // optional; ensure installed
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store for OTPs: { "+1|123456789": { otp: '123456', expiresAt: ... } }
// For production use a proper datastore and expiry mechanism
const otpStore = new Map();

// In-memory data (for demo). Replace with DB as needed.
const db = {
  user: {
    name: 'Mirror User',
    about: 'Hey there! I am using Mirror',
    phone: '+1 234 567 8900',
    avatar: null
  },
  contacts: [
    { id: 1, name: 'John Doe', avatar: null },
    { id: 2, name: 'Jane Smith', avatar: null },
    { id: 3, name: 'Mike Johnson', avatar: null },
    { id: 4, name: 'Sarah Wilson', avatar: null },
    { id: 5, name: 'Tom Brown', avatar: null }
  ],
  chats: [
    // sample chat:
    // { id: 1630000000000, contactId: 1, name: 'John Doe', messages: [{text:'hi', type:'received', time:'12:00'}], lastMessage:'hi', time:'12:00' }
  ]
};

// Helpers from Mirror app
function getChatById(id) {
  return db.chats.find(c => c.id === Number(id));
}

function getChatByContactId(contactId) {
  return db.chats.find(c => c.contactId === Number(contactId));
}

function genTime() {
  return new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

// Middlewares
app.use(bodyParser.json({ limit: '10mb' })); // allow base64 images
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }, // set secure:true on HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

// Passport user serialization
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// ---------- Passport Strategies (fill env vars) ----------
// Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK || '/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    // In production, link/create user in DB here
    done(null, { provider: 'google', profile });
  }));
}

// Facebook
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK || '/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'photos', 'email']
  }, (accessToken, refreshToken, profile, done) => {
    done(null, { provider: 'facebook', profile });
  }));
}

// Instagram (passport-instagram)
// Note: Instagram API policies changed; for many apps you'll need the Instagram Basic Display or Graph API.
// This code uses passport-instagram as an example if you have an OAuth app set up.
if (process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET) {
  passport.use(new InstagramStrategy({
    clientID: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    callbackURL: process.env.INSTAGRAM_CALLBACK || '/auth/instagram/callback'
  }, (accessToken, refreshToken, profile, done) => {
    done(null, { provider: 'instagram', profile });
  }));
}

// ---------- Routes ----------

// Mock phone OTP request
app.post('/auth/phone', (req, res) => {
  const { countryCode, phoneNumber } = req.body || {};
  if (!countryCode || !phoneNumber) {
    return res.status(400).json({ message: 'Missing countryCode or phoneNumber' });
  }

  const key = `${countryCode}|${phoneNumber}`;
  // generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes

  otpStore.set(key, { otp, expiresAt });

  // TODO: integrate with SMS provider instead of console.log
  console.log(`[OTP SENT] ${key} -> ${otp} (expires in 5 minutes)`);

  res.json({ message: 'OTP sent (for demo check server logs)' });
});

// Verify OTP
app.post('/auth/verify-otp', (req, res) => {
  const { countryCode, phoneNumber, otp } = req.body || {};
  if (!countryCode || !phoneNumber || !otp) {
    return res.status(400).json({ message: 'Missing parameters' });
  }

  const key = `${countryCode}|${phoneNumber}`;
  const record = otpStore.get(key);
  if (!record) {
    return res.status(400).json({ message: 'No OTP requested for this number' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ message: 'OTP expired' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  // OTP valid: create a basic session user
  const user = { id: crypto.randomUUID(), provider: 'phone', phone: `${countryCode} ${phoneNumber}` };
  req.login(user, (err) => {
    if (err) {
      return res.status(500).json({ message: 'Login error' });
    }
    otpStore.delete(key);
    return res.json({ message: 'Verified', user });
  });
});

// ---------- Social login routes using passport ----------

// Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Successful auth, redirect to profile or front-end route
    res.redirect('/auth/success');
  }
);

// Facebook
app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/auth/failure' }),
  (req, res) => res.redirect('/auth/success')
);

// Instagram
app.get('/auth/instagram',
  passport.authenticate('instagram')
);

app.get('/auth/instagram/callback',
  passport.authenticate('instagram', { failureRedirect: '/auth/failure' }),
  (req, res) => res.redirect('/auth/success')
);

// Simple success/failure pages (can be improved)
app.get('/auth/success', (req, res) => {
  if (!req.user) {
    return res.redirect('/auth/failure');
  }
  // server will serve a small html page with user info
  res.send(`
    <h1>Login successful</h1>
    <pre>${JSON.stringify(req.user, null, 2)}</pre>
    <p><a href="/">Go back</a></p>
    <p><a href="/logout">Logout</a></p>
  `);
});

app.get('/auth/failure', (req, res) => {
  res.send('<h1>Authentication Failed</h1><p><a href="/">Try again</a></p>');
});

app.get('/logout', (req, res, next) => {
  // Support both callback and no-callback signatures of req.logout
  try {
    req.logout(() => {
      res.redirect('/');
    });
  } catch (e) {
    // older versions may not accept callback
    req.logout();
    res.redirect('/');
  }
});

// Protected profile endpoint
app.get('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

// Mirror app API Endpoints

app.get('/api/init', (req, res) => {
  res.json({
    user: db.user,
    contacts: db.contacts,
    chats: db.chats
  });
});

app.get('/api/contacts', (req, res) => {
  res.json(db.contacts);
});

app.get('/api/chats', (req, res) => {
  res.json(db.chats);
});

app.get('/api/chats/:id', (req, res) => {
  const chat = getChatById(req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  res.json(chat);
});

app.post('/api/chats', (req, res) => {
  const { contactId } = req.body;
  if (typeof contactId === 'undefined') return res.status(400).json({ error: 'contactId is required' });

  let chat = getChatByContactId(contactId);
  if (chat) {
    return res.json(chat);
  }

  const contact = db.contacts.find(c => c.id === Number(contactId));
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const newChat = {
    id: Date.now(),
    contactId: contact.id,
    name: contact.name,
    messages: [],
    lastMessage: '',
    time: genTime()
  };
  db.chats.push(newChat);
  res.json(newChat);
});

app.post('/api/chats/:id/messages', (req, res) => {
  const chat = getChatById(req.params.id);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  const { text, type } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const message = {
    text,
    type: type || 'sent',
    time: genTime()
  };

  chat.messages.push(message);
  chat.lastMessage = text;
  chat.time = genTime();

  // Simulate an automated reply after 1s
  setTimeout(() => {
    const responses = ['Hey! How are you?', 'That sounds great!', 'I agree with you.', 'Interesting point!', 'Let me think about it.', 'Sure, no problem!', 'Thanks for letting me know.'];
    const random = responses[Math.floor(Math.random() * responses.length)];
    const reply = { text: random, type: 'received', time: genTime() };
    chat.messages.push(reply);
    chat.lastMessage = random;
    chat.time = genTime();
  }, 1000);

  res.json(chat);
});

app.post('/api/profile', (req, res) => {
  const { name, about, phone, avatar } = req.body;
  if (name) db.user.name = name;
  if (about) db.user.about = about;
  if (phone) db.user.phone = phone;
  if (avatar) db.user.avatar = avatar;
  res.json(db.user);
});

// Fallback to index.html for SPA paths (if necessary)
app.get((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
});