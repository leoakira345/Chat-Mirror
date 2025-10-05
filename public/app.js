// app.js - client-side logic (expanded for mock 6-digit user IDs, search & friend flow)

let appData = {
  user: null,
  contacts: [],
  chats: [],
  currentChatId: null
};

// In-page mock data structures for the 6-digit user system
let mockUsers = {};
const mockState = {
  friendships: new Set(), // keys as "A-B" where A,B are user ids
  requests: []              // { from: id, to: id, status: 'pending'|'accepted' }
};

// Simple helper to generate a chat id
function generateChatId() {
  const base = (appData.chats?.length || 0) + 1;
  return 'c' + (1000 + base + Math.floor(Math.random() * 900)).toString().slice(-4);
}
function relationKey(a,b){
  return [a,b].sort().join('-');
}
function currentUserId(){
  return appData.user?.id || '100001';
}
function isFriendWith(targetId){
  return mockState.friendships.has(relationKey(currentUserId(), targetId));
}
function isPendingWith(targetId){
  const me = currentUserId();
  return mockState.requests.some(r => 
    ((r.from===me && r.to===targetId) || (r.from===targetId && r.to===me)) && r.status==='pending'
  );
}

// Initialize mock dataset (called on init fallback)
function initMockData() {
  // Create mock users (6-digit IDs)
  mockUsers = {
    "100001": { id:"100001", name:"You" },
    "200001": { id:"200001", name:"Alex Chen" },
    "200002": { id:"200002", name:"Priya Patel" },
    "300001": { id:"300001", name:"Luis Martinez" },
    "300002": { id:"300002", name:"Emma Rossi" },
  };
  // Set the current user
  appData.user = mockUsers["100001"];
  appData.chats = []; // start with no chats
  mockState.friendships.clear();
  mockState.requests = [];
  console.log("Mirror: Mock data initialized");
}

// UI: Search user by 6-digit ID (top bar)
function searchUserByIdUI(){
  const input = document.getElementById('userIdInput');
  const id = (input.value || '').trim();
  const found = mockUsers[id];
  const hint = document.getElementById('userSearchHint');
  if (!/^\d{6}$/.test(id)) {
    // not a valid 6-digit
    document.getElementById('foundUserPanel').style.display = 'none';
    document.getElementById('incomingRequestsPanel').style.display = 'none';
    hint.textContent = "Please enter a valid 6-digit ID (e.g., 200001)";
    return;
  }
  if (!found) {
    document.getElementById('foundUserPanel').style.display = 'none';
    // also reset incoming requests for clarity
    renderIncomingRequests();
    hint.textContent = "User not found.";
    return;
  }
  // Populate found user panel
  document.getElementById('foundUserPanel').style.display = 'flex';
  const initials = found.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('foundUserAvatar').textContent = initials;
  document.getElementById('foundUserName').textContent = found.name;
  document.getElementById('foundUserId').textContent = 'ID: ' + found.id;

  // Update Add button state
  window.__lastSearchTargetId = id;
  updateAddFriendButtonState();

  // Update incoming requests (recipient side)
  renderIncomingRequests();
  hint.textContent = '';
}

function updateAddFriendButtonState(){
  const targetId = window.__lastSearchTargetId;
  const btn = document.getElementById('addFriendBtn');
  if (!targetId || !btn) return;
  if (isFriendWith(targetId)){
    btn.textContent = 'Friends';
    btn.disabled = true;
    btn.style.background = '#777';
  } else if (isPendingWith(targetId)){
    btn.textContent = 'Request Pending';
    btn.disabled = true;
    btn.style.background = '#555';
  } else {
    btn.textContent = 'Add Friend';
    btn.disabled = false;
    btn.style.background = '#00a884';
  }
}

// Send a friend request from search result
function sendFriendRequestFromSearch(){
  const targetId = window.__lastSearchTargetId;
  if (!targetId) return;
  const current = currentUserId();

  // Basic validation
  if (isFriendWith(targetId) || isPendingWith(targetId)) {
    updateAddFriendButtonState();
    return;
  }

  // Create a pending request (sender -> recipient)
  mockState.requests.push({ from: current, to: targetId, status: 'pending' });
  // Update UI
  updateAddFriendButtonState();
  renderIncomingRequests();

  // Also show a simulated "recipient" incoming notification panel
  // No separate recipient side UI exists in this single-page mock beyond the panel below
  // You can optionally auto-display a brief toast/notification here
  showToast('Friend request sent to ' + mockUsers[targetId].name);
}

// Recipient side: render incoming requests for current user
function renderIncomingRequests(){
  const current = currentUserId();
  const container = document.getElementById('incomingRequestsContainer');
  if (!container) return;
  const items = mockState.requests.filter(r => r.to === current && r.status === 'pending');
  const hasAny = items.length > 0;
  document.getElementById('incomingRequestsPanel').style.display = hasAny ? 'block' : 'none';
  container.innerHTML = items.map(r => {
    const fromUser = mockUsers[r.from];
    const initials = (fromUser?.name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
    return `
      <div class="incoming-request-item" style="display:flex;align-items:center;gap:12px;">
        <div class="contact-avatar" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#6b7c85">${initials}</div>
        <div style="flex:1">
          <div style="font-weight:600">${fromUser?.name || r.from}</div>
          <div style="font-size:12px;color:#8b9aa3">wants to be your friend</div>
        </div>
        <button class="icon-btn" onclick="confirmFriend('${r.from}', '${r.to}')" style="width:90px;height:34px;background:#00a884;border-radius:6px;border:none;color:white;font-weight:600">Confirm</button>
      </div>
    `;
  }).join('');
}

// Confirm a friend request (recipient accepts)
function confirmFriend(fromId, toId){
  // Find and update the pending request
  const idx = mockState.requests.findIndex(r => r.from===fromId && r.to===toId && r.status==='pending');
  if (idx >= 0) mockState.requests[idx].status = 'accepted';
  // Create friendship relation
  mockState.friendships.add(relationKey(fromId, toId));

  // Create a new chat between the two
  const otherName = mockUsers[toId]?.name || toId;
  const chatName = otherName;
  const chatId = generateChatId();
  const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const newChat = {
    id: chatId,
    name: chatName,
    time,
    lastMessage: 'You are now friends. Say hi!',
    messages: [
      { text: 'Hi ' + otherName.split(' ')[0] + ', nice to meet you!', type: 'sent', time },
      { text: 'Hi! Great to meet you too.', type: 'received', time }
    ]
  };
  appData.chats = appData.chats || [];
  appData.chats.push(newChat);

  // UI updates
  renderChats();
  renderIncomingRequests();
  openChat(chatId);
  // Also update the search Add button to "Friends"
  updateAddFriendButtonState();
}

// Render the chat list UI
function renderChats() {
  const list = document.getElementById('chatList');
  if (!appData.chats || appData.chats.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:#8696a0">No chats yet. Start a new conversation!</div>';
    return;
  }
  list.innerHTML = appData.chats.map(chat => `
    <div class="chat-item ${chat.id===appData.currentChatId?'active':''}" onclick="openChat('${chat.id}')">
      <div class="chat-avatar">${chat.name.split(' ').map(n=>n[0]).join('')}</div>
      <div class="chat-info">
        <div class="chat-header">
          <div class="chat-name">${chat.name}</div>
          <div class="chat-time">${chat.time || ''}</div>
        </div>
        <div class="chat-preview">${chat.lastMessage || 'No messages yet'}</div>
      </div>
    </div>
  `).join('');
}

// A simple toast helper
function showToast(message){
  let el = document.getElementById('toast');
  if (!el){
    el = document.createElement('div');
    el.id = 'toast';
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.background = '#1e1f24';
    el.style.color = '#e9edef';
    el.style.padding = '10px 14px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 2px 10px rgba(0,0,0,.5)';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  setTimeout(() => el.style.opacity = '0', 1500);
}

// Open a chat from the list
function openChat(chatId){
  appData.currentChatId = chatId;
  // Ensure we have latest chat data (no server calls in mock)
  renderMessages();
  // Show chat area
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatArea').style.display = 'flex';
  const chat = appData.chats.find(c => c.id === chatId);
  if (chat) {
    document.getElementById('chatHeaderName').textContent = chat.name;
    document.getElementById('chatHeaderInitials').textContent = chat.name.split(' ').map(n=>n[0]).join('').toUpperCase();
  }
  // Scroll messages to bottom
  const container = document.getElementById('messagesContainer');
  if (container) container.scrollTop = container.scrollHeight;
}

// Render messages for current chat
function renderMessages(){
  const container = document.getElementById('messagesContainer');
  const chat = appData.chats.find(c => c.id === appData.currentChatId);
  if (!container || !chat){
    container && (container.innerHTML = '');
    return;
  }
  container.innerHTML = chat.messages.map(msg => {
    if (msg.fileUrl) {
      if (msg.isImage) {
        return `
          <div class="message ${msg.type}">
            <div class="message-bubble">
              <img src="${escapeHtml(msg.fileUrl)}" alt="attachment" style="max-width:260px;border-radius:6px"/>
              ${msg.text ? `<div class="message-text" style="margin-top:6px">${escapeHtml(msg.text)}</div>` : ''}
              <div class="message-time">${escapeHtml(msg.time || '')}</div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="message ${msg.type}">
            <div class="message-bubble">
              <a href="${escapeHtml(msg.fileUrl)}" target="_blank" class="message-text" style="display:inline-block;margin-bottom:6px">${escapeHtml(msg.fileName || 'Attachment')}</a>
              ${msg.text ? `<div class="message-text" style="margin-top:6px">${escapeHtml(msg.text)}</div>` : ''}
              <div class="message-time">${escapeHtml(msg.time || '')}</div>
            </div>
          </div>
        `;
      }
    } else {
      return `
        <div class="message ${msg.type}">
          <div class="message-bubble">
            <div class="message-text">${escapeHtml(msg.text || '')}</div>
            <div class="message-time">${escapeHtml(msg.time || '')}</div>
          </div>
        </div>
      `;
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(unsafe) {
  return unsafe
       .toString()
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}

// File attachment handling (preserve original behavior; also add mock integration)
function handleSelectedFile(file, isImage){
  if (!file) return;
  const chatId = appData.currentChatId;
  if (!chatId) return;
  const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  // Read as data URL for immediate preview
  const reader = new FileReader();
  reader.onload = async function(ev){
    const dataUrl = ev.target.result;
    // Optimistic client update
    const chat = appData.chats.find(c => c.id === chatId);
    const newMsg = {
      text: '',
      type: 'sent',
      time,
      fileUrl: dataUrl,
      isImage: isImage,
      fileName: file.name
    };
    if (chat) {
      chat.messages.push(newMsg);
      chat.lastMessage = newMsg.fileName;
      chat.time = time;
      renderMessages();
      renderChats();
    }

    // Upload to server for persistence (stubbed in mock)
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/chats/${chatId}/files`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json && json.fileUrl) {
        if (chat) {
          const idx = chat.messages.length - 1;
          chat.messages[idx].fileUrl = json.fileUrl;
          chat.messages[idx].isImage = json.isImage;
          chat.messages[idx].fileName = json.fileName || file.name;
          renderMessages();
          renderChats();
        }
      }
    } catch (err) {
      console.error('Failed to upload file', err);
    }
  };
  reader.readAsDataURL(file);
}

// Send text message
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !appData.currentChatId) return;
  const chatId = appData.currentChatId;
  const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  // Optimistic update on client
  const chat = appData.chats.find(c => c.id === chatId);
  if (chat) {
    chat.messages.push({ text, type: 'sent', time });
    chat.lastMessage = text;
    chat.time = time;
    renderMessages();
    renderChats();
  }

  input.value = '';

  // Send to server (may be mocked)
  try {
    await fetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ text, type: 'sent' })
    });
    // server may post automated reply; fetch latest
    const res = await fetch(`/api/chats/${chatId}`);
    const updated = await res.json();
    const idx = appData.chats.findIndex(c => c.id === updated.id);
    if (idx >= 0) appData.chats[idx] = updated;
    else appData.chats.push(updated);
    renderMessages();
    renderChats();
  } catch (err) {
    console.error('Failed to send message', err);
  }
}

// Initialize app on load
async function init(){
  try {
    const res = await fetch('/api/init');
    const data = await res.json();
    appData.user = data.user;
    appData.contacts = data.contacts;
    appData.chats = data.chats;
    bindUI();
    loadProfile();
    renderChats();
  } catch (err){
    console.warn('API init failed, using mock data', err);
    // Setup mock data instead
    initMockData();
    // Bind UI and render with mock data
    bindUI();
    loadProfile();
    renderChats();
  }
}

// Re-use existing behavior for profile loading
function bindUI() {
  // profile pic change in modal (existing)
  document.getElementById('profilePicInput').addEventListener('change', onProfilePicChange);
  document.getElementById('messageInput').addEventListener('keypress', function(e){
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  document.getElementById('searchInput').addEventListener('input', function(e){
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.chat-item');
    items.forEach(item => {
      const name = item.querySelector('.chat-name').textContent.toLowerCase();
      item.style.display = name.includes(query) ? 'flex' : 'none';
    });
  });
  window.onclick = function(e) {
    // Close dropdowns if clicking outside
    if (!e.target.closest('#attachBtn') && !e.target.closest('.attach-dropdown') && !e.target.closest('#emojiBtn') && !e.target.closest('.emoji-picker')) {
      const dropdown = document.getElementById('attachDropdown');
      if (dropdown && dropdown.style.display === 'block') dropdown.style.display = 'none';
      const emojiBox = document.getElementById('emojiPicker');
      if (emojiBox && emojiBox.style.display === 'flex') emojiBox.style.display = 'none';
    }
  };
  // Inputs for file attachments
  document.getElementById('galleryInput').addEventListener('change', (e) => handleSelectedFile(e.target.files[0], true));
  document.getElementById('fileInput').addEventListener('change', (e) => handleSelectedFile(e.target.files[0], false));
  document.getElementById('cameraInput').addEventListener('change', (e) => handleSelectedFile(e.target.files[0], true));
}

function toggleMenu(){const m=document.getElementById('menuDropdown');m.classList.toggle('active')}

function openProfileModal(){closeModal('settingsModal');document.getElementById('profileModal').classList.add('active');loadProfile()}
function openSettingsModal(){document.getElementById('settingsModal').classList.add('active')}
function openNewChatModal(){document.getElementById('newChatModal').classList.add('active');renderContacts()}
function closeModal(id){document.getElementById(id).classList.remove('active')}

// Attachments logic (same as previous, kept for compatibility)
function toggleAttachMenu(){ 
  const el = document.getElementById('attachDropdown');
  if (!el) return;
  el.style.display = (el.style.display === 'block') ? 'none' : 'block';
  // Hide emoji picker if open
  const emojiBox = document.getElementById('emojiPicker');
  if (emojiBox) emojiBox.style.display = 'none';
}
function triggerGallery(){ document.getElementById('galleryInput').click(); }
function triggerFile(){ document.getElementById('fileInput').click(); }
function triggerCamera(){ document.getElementById('cameraInput').click(); }

function toggleEmojiPicker(){
  const picker = document.getElementById('emojiPicker');
  if (!picker) return;
  const isVisible = picker.style.display === 'flex';
  picker.style.display = isVisible ? 'none' : 'flex';
  // Also close attach dropdown if open
  const ad = document.getElementById('attachDropdown');
  if (ad) ad.style.display = 'none';
}
function insertEmoji(emoji){
  const ta = document.getElementById('messageInput');
  if (!ta) return;
  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  ta.value = before + emoji + after;
  // Move cursor after inserted emoji
  const pos = start + emoji.length;
  ta.selectionStart = ta.selectionEnd = pos;
  ta.focus();
}
function loadProfile() {
  if (!appData.user) return;
  document.getElementById('profileName').value = appData.user.name || '';
  document.getElementById('profileAbout').value = appData.user.about || '';
  document.getElementById('profilePhone').value = appData.user.phone || '';
  const initials = (appData.user.name || '').split(' ').map(n => n[0] || '').join('').toUpperCase() || 'M';
  document.getElementById('profileInitialsLarge').textContent = initials;
  document.getElementById('sidebarInitials').textContent = initials;
  if (appData.user.avatar) {
    document.getElementById('profilePicLarge').innerHTML = `<img src="${appData.user.avatar}" alt="Profile"><div class="upload-overlay" onclick="document.getElementById('profilePicInput').click()"><i class="fas fa-camera"></i></div>`;
    document.getElementById('sidebarProfilePic').innerHTML = `<img src="${appData.user.avatar}" alt="Profile">`;
  }
}

async function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const about = document.getElementById('profileAbout').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  appData.user.name = name;
  appData.user.about = about;
  appData.user.phone = phone;
  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(appData.user)
    });
    const initials = (name || '').split(' ').map(n => n[0] || '').join('').toUpperCase();
    document.getElementById('sidebarInitials').textContent = initials;
    closeModal('profileModal');
    renderChats();
  } catch (err) {
    console.error('Failed to save profile', err);
  }
}

function onProfilePicChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(ev) {
    const dataUrl = ev.target.result;
    appData.user.avatar = dataUrl;
    document.getElementById('profilePicLarge').innerHTML = `<img src="${dataUrl}" alt="Profile"><div class="upload-overlay" onclick="document.getElementById('profilePicInput').click()"><i class="fas fa-camera"></i></div>`;
    document.getElementById('sidebarProfilePic').innerHTML = `<img src="${dataUrl}" alt="Profile">`;
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(appData.user)
      });
    } catch (err) {
      console.error('Failed to upload avatar', err);
    }
  };
  reader.readAsDataURL(file);
}

function renderContacts(){
  const list = document.getElementById('contactsList');
  list.innerHTML = Object.values(mockUsers).map(c => 
    `<div class="contact-item" onclick="startChat('${c.id}')">
      <div class="contact-avatar">${(c.name || c.id).split(' ').map(n=>n[0]).join('')}</div>
      <div class="contact-name">${c.name}</div>
    </div>`
  ).join('');
}

async function startChat(contactId) {
  // In mock mode: create/find chat quickly
  const existingChat = appData.chats.find(c => c.name === mockUsers[contactId]?.name);
  if (existingChat) {
    openChat(existingChat.id);
    return;
  }
  const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const chatName = mockUsers[contactId]?.name || contactId;
  const newChat = {
    id: generateChatId(),
    name: chatName,
    time: now,
    lastMessage: 'Chat started.',
    messages: [
      { text: 'Hi ' + chatName.split(' ')[0] + ', nice to connect!', type: 'sent', time: now }
    ]
  };
  appData.chats.push(newChat);
  renderChats();
  openChat(newChat.id);
  // Close the New Chat modal if open
  closeModal('newChatModal');
}

function renderContactsAndOpen(tag) {
  renderContacts();
  // Could auto-open chat modal if desired
  if (tag) {
    // placeholder for potential future feature
  }
}

// Initialize app on load
init();
