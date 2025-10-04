/* app.js (put this content into /app.js) */

/*
  This script:
  - Implements the file picker popover when the paperclip button is clicked (shows options: File, Music, Docs, Image).
  - Hooks hidden file inputs for each option and handles selected files (shows previews in messages area).
  - Provides minimal implementations for referenced UI functions (modals, toggles, sending text messages).
  - Persists and applies profile picture across the UI when saving profile (fix requested).
  - Keeps original HTML unchanged and works entirely from this script + styles.css above.
*/

document.addEventListener('DOMContentLoaded', function () {
  // Basic UI hooks
  const messagesContainer = document.getElementById('messagesContainer');
  const inputArea = document.querySelector('.input-area');
  const messageInput = document.getElementById('messageInput');

  // guard early if required elements aren't present
  if (!messagesContainer) {
    console.warn('messagesContainer not found - file picker will still initialize but no previews will be shown.');
  }
  if (!inputArea) {
    console.warn('.input-area not found - file popover may not be positioned correctly.');
  }
  if (!messageInput) {
    console.warn('messageInput not found - sendMessage will not be wired to Enter key.');
  }

  // Ensure chat area visible for demo (guarded)
  const emptyStateEl = document.getElementById('emptyState');
  const chatAreaEl = document.getElementById('chatArea');
  if (emptyStateEl) emptyStateEl.style.display = 'none';
  if (chatAreaEl) chatAreaEl.style.display = 'flex';

  // Load persisted profile picture (if any) and apply across UI
  (function loadPersistedProfileImage() {
    try {
      const stored = localStorage.getItem('chat_profile_pfp');
      if (stored) applyProfileImageToAll(stored);
    } catch (e) {
      console.warn('Could not load persisted profile image:', e);
    }
  })();

  // Create hidden file inputs
  const hiddenInputs = {
    all: createHiddenInput('*/*', true),
    music: createHiddenInput('audio/*', true),
    docs: createHiddenInput('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt', true),
    image: createHiddenInput('image/*', true)
  };

  // Find the paperclip button inside input-area
  // Using multiple fallbacks to maximize compatibility with various HTML structures
  let paperclipBtn = null;
  if (inputArea) {
    paperclipBtn = inputArea.querySelector('.icon-btn i.fa-paperclip')?.parentElement
                 || inputArea.querySelector('.icon-btn.fa-paperclip')
                 || inputArea.querySelector('.fa-paperclip')?.parentElement;
  }
  if (!paperclipBtn) {
    console.warn('Paperclip button not found in .input-area');
    // create a dummy element so the rest of the code doesn't crash,
    // but it won't be visible unless the HTML actually has the button.
    paperclipBtn = document.createElement('div');
  }

  // Create the popover element (but don't attach yet)
  const popover = createFilePopover();
  if (inputArea) inputArea.appendChild(popover); // attach but hidden by CSS (we toggle display)
  hidePopover();

  // Wire up popover option clicks to file inputs
  const optFile = popover.querySelector('[data-type="file"]');
  const optMusic = popover.querySelector('[data-type="music"]');
  const optDocs = popover.querySelector('[data-type="docs"]');
  const optImage = popover.querySelector('[data-type="image"]');

  if (optFile) optFile.addEventListener('click', () => hiddenInputs.all.click());
  if (optMusic) optMusic.addEventListener('click', () => hiddenInputs.music.click());
  if (optDocs) optDocs.addEventListener('click', () => hiddenInputs.docs.click());
  if (optImage) optImage.addEventListener('click', () => hiddenInputs.image.click());

  // Handle file selection
  for (const [type, inputEl] of Object.entries(hiddenInputs)) {
    inputEl.addEventListener('change', (ev) => {
      const files = Array.from(ev.target.files || []);
      if (files.length === 0) return;
      handleFiles(files, type);
      inputEl.value = ''; // allow selecting same file again later
      hidePopover();
    });
  }

  // Toggle popover on paperclip button click
  paperclipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });

  // close popover when clicking outside (guard to ensure popover exists)
  document.addEventListener('click', (e) => {
    if (!inputArea) return;
    if (!inputArea.contains(e.target)) hidePopover();
  });

  // --------- Functions implemented below ---------

  function createHiddenInput(accept, multiple = false) {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.accept = accept;
    if (multiple) input.multiple = true;
    document.body.appendChild(input);
    return input;
  }

  function createFilePopover() {
    const wrap = document.createElement('div');
    wrap.className = 'file-popover';
    // minimal inline style to ensure visibility in many layouts, can be overridden by CSS
    wrap.style.position = 'absolute';
    wrap.style.bottom = '56px';
    wrap.style.right = '12px';
    wrap.style.display = 'none';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    wrap.style.background = 'var(--popover-bg, #ffffff)';
    wrap.style.border = '1px solid rgba(0,0,0,0.06)';
    wrap.style.padding = '8px';
    wrap.style.borderRadius = '8px';
    wrap.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
    wrap.style.zIndex = 9999;
    wrap.style.minWidth = '120px';
    wrap.style.alignItems = 'stretch';

    // structure: 4 vertical buttons
    const items = [
      { key: 'file', icon: 'fas fa-paperclip', label: 'File' },
      { key: 'music', icon: 'fas fa-music', label: 'Music' },
      { key: 'docs', icon: 'fas fa-file-lines', label: 'Docs' },
      { key: 'image', icon: 'fas fa-image', label: 'Image' }
    ];
    items.forEach(it => {
      const btn = document.createElement('div');
      btn.className = 'pop-btn';
      btn.setAttribute('data-type', it.key);
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '8px';
      btn.style.padding = '8px';
      btn.style.cursor = 'pointer';
      btn.style.borderRadius = '6px';
      btn.style.transition = 'background .12s ease';
      btn.innerHTML = `<i class="${it.icon}" style="width:20px;text-align:center"></i><span style="flex:1">${it.label}</span>`;
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(0,0,0,0.04)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function togglePopover() {
    if (popover.style.display === 'flex') hidePopover();
    else showPopover();
  }

  function showPopover() {
    popover.style.display = 'flex';
    // position: ensure popover sits above the buttons; CSS anchored with bottom property
    // try to position relative to paperclipBtn if possible
    try {
      const rect = paperclipBtn.getBoundingClientRect();
      const parentRect = inputArea?.getBoundingClientRect();
      // prefer positioning within inputArea if available
      if (parentRect) {
        // compute local right/bottom in parent
        const right = parentRect.right - rect.right + 12;
        const bottom = parentRect.bottom - rect.top + 12;
        popover.style.right = `${right}px`;
        popover.style.bottom = `${bottom}px`;
      } else {
        // fallback: position near viewport
        popover.style.right = `${Math.max(12, window.innerWidth - rect.right + 12)}px`;
        popover.style.bottom = `${Math.max(56, window.innerHeight - rect.top + 12)}px`;
      }
    } catch (e) {
      // ignore positioning errors
    }
  }

  function hidePopover() {
    popover.style.display = 'none';
  }

  function handleFiles(files, type) {
    files.forEach(file => {
      // Create a message bubble
      const msg = document.createElement('div');
      // Basic CSS classes used by some chat templates; keep them to ease styling integration
      msg.className = 'msg me';
      msg.style.marginBottom = '12px';
      msg.style.maxWidth = '85%';
      msg.style.alignSelf = 'flex-end';

      // create a container bubble
      const bubble = document.createElement('div');
      bubble.style.background = 'var(--bubble-bg, #e9f4f2)';
      bubble.style.padding = '10px';
      bubble.style.borderRadius = '12px';
      bubble.style.boxShadow = '0 1px 0 rgba(0,0,0,0.02)';
      bubble.style.display = 'flex';
      bubble.style.flexDirection = 'column';
      bubble.style.gap = '8px';

      // Header (filename & size)
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.gap = '8px';
      const nameEl = document.createElement('div');
      nameEl.style.fontWeight = '600';
      nameEl.style.overflow = 'hidden';
      nameEl.style.textOverflow = 'ellipsis';
      nameEl.style.whiteSpace = 'nowrap';
      nameEl.style.maxWidth = '220px';
      nameEl.textContent = file.name;
      const sizeEl = document.createElement('div');
      sizeEl.className = 'small';
      sizeEl.style.opacity = '0.8';
      sizeEl.textContent = humanFileSize(file.size);
      header.appendChild(nameEl);
      header.appendChild(sizeEl);
      bubble.appendChild(header);

      // Content preview depending on file type
      const preview = document.createElement('div');
      preview.className = 'file-preview';

      const mime = file.type || '';
      if (mime.startsWith('image/') || type === 'image') {
        // image preview using objectURL (preserves original quality)
        const img = document.createElement('img');
        img.alt = file.name;
        const url = URL.createObjectURL(file);
        img.src = url;
        img.style.maxWidth = '320px';
        img.style.borderRadius = '8px';
        img.style.cursor = 'zoom-in';
        img.style.display = 'block';
        // clicking opens full-size in new tab (real original file)
        img.addEventListener('click', () => {
          window.open(url, '_blank');
        });
        preview.appendChild(img);
      } else if (mime.startsWith('audio/') || type === 'music') {
        // audio player
        const audioWrap = document.createElement('div');
        audioWrap.style.display = 'block';
        const audio = document.createElement('audio');
        audio.controls = true;
        const src = URL.createObjectURL(file);
        audio.src = src;
        audio.style.width = '100%';
        audioWrap.appendChild(audio);
        preview.appendChild(audioWrap);
      } else if (mime.startsWith('video/') || type === 'video') {
        // video player
        const video = document.createElement('video');
        video.controls = true;
        const vsrc = URL.createObjectURL(file);
        video.src = vsrc;
        video.style.maxWidth = '320px';
        video.style.borderRadius = '8px';
        preview.appendChild(video);
      } else {
        // generic doc/file view
        const docBox = document.createElement('div');
        docBox.className = 'doc-box';
        docBox.style.display = 'flex';
        docBox.style.alignItems = 'center';
        docBox.style.gap = '10px';

        const icon = document.createElement('div');
        icon.className = 'doc-icon';
        icon.style.fontSize = '20px';
        icon.style.width = '36px';
        icon.style.height = '36px';
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.borderRadius = '6px';
        icon.style.background = 'rgba(0,0,0,0.04)';

        // choose icon by extension roughly
        const ext = getExtension(file.name).toLowerCase();
        if (['pdf'].includes(ext)) icon.innerHTML = '<i class="fas fa-file-pdf" style="color:#e04b4b"></i>';
        else if (['doc','docx'].includes(ext)) icon.innerHTML = '<i class="fas fa-file-word" style="color:#2b7a78"></i>';
        else if (['xls','xlsx'].includes(ext)) icon.innerHTML = '<i class="fas fa-file-excel" style="color:#2a9d3a"></i>';
        else icon.innerHTML = '<i class="fas fa-file" style="color:#2b7a78"></i>';

        const info = document.createElement('div');
        info.className = 'doc-info';
        info.style.display = 'flex';
        info.style.flexDirection = 'column';
        info.style.gap = '6px';
        const title = document.createElement('div');
        title.textContent = file.name;
        title.style.fontWeight = '600';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.whiteSpace = 'nowrap';
        title.style.maxWidth = '220px';
        const download = document.createElement('a');
        download.textContent = 'Download';
        download.className = 'small';
        download.href = URL.createObjectURL(file);
        download.download = file.name;
        download.style.display = 'inline-block';
        download.style.marginTop = '0px';
        download.style.color = 'var(--accent, #2b7a78)';
        download.style.textDecoration = 'none';
        info.appendChild(title);
        info.appendChild(download);

        docBox.appendChild(icon);
        docBox.appendChild(info);
        preview.appendChild(docBox);
      }

      // Add preview to bubble
      bubble.appendChild(preview);

      // Add timestamp/meta
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.style.opacity = '0.7';
      meta.style.fontSize = '12px';
      meta.style.alignSelf = 'flex-end';
      meta.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      bubble.appendChild(meta);
      msg.appendChild(bubble);

      if (messagesContainer) {
        messagesContainer.appendChild(msg);
        // scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } else {
        // if no messages container, append to body for debug
        document.body.appendChild(msg);
      }

      // revoke object URLs after a delay to free memory (except for downloads where browser keeps it)
      setTimeout(() => {
        try {
          // best-effort revoke for preview URLs
          const urlsToRevoke = [];
          // gather object URLs from elements inside bubble (img/audio/video/a)
          bubble.querySelectorAll('img, audio, video, a').forEach(el => {
            const src = el.src || el.href;
            if (src && src.startsWith('blob:')) urlsToRevoke.push(src);
          });
          urlsToRevoke.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        } catch (e) {}
      }, 30 * 1000);
    });
  }

  // Utility: friendly file size
  function humanFileSize(bytes, si = true) {
    const thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) return bytes + ' B';
    const units = si ? ['KB','MB','GB','TB'] : ['KiB','MiB','GiB','TiB'];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
  }

  function getExtension(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  // ----------------- Minimal implementations of referenced UI functions -----------------
  window.openProfileModal = function () {
    showModal('profileModal');
  };
  window.openSettingsModal = function () {
    showModal('settingsModal');
  };
  window.openNewChatModal = function () {
    showModal('newChatModal');
  };
  window.toggleMenu = function () {
    const menu = document.getElementById('menuDropdown');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  };
  window.closeModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  };

  // Improved saveProfile: apply uploaded profile image across the UI and persist it
  window.saveProfile = function () {
    const modal = document.getElementById('profileModal');
    if (!modal) {
      // fallback behavior if modal not present
      closeModal('profileModal');
      try { alert('Profile saved (demo)'); } catch (e) {}
      return;
    }

    // Strategy:
    // 1) Look for input[type=file] inside profileModal (common pattern). If present and file selected, read as DataURL.
    // 2) Otherwise, look for a text input for image URL (name or id 'profileImageUrl' or 'imageUrl') and use its value.
    // 3) Apply the resulting image to all known avatar elements, persist to localStorage, close modal.

    const fileInput = modal.querySelector('input[type="file"]');
    const urlInput = modal.querySelector('input[name="profileImageUrl"], input[id="profileImageUrl"], input[name="imageUrl"], input[id="imageUrl"]');

    function finishSaveWithDataUrl(dataUrl) {
      try {
        applyProfileImageToAll(dataUrl);
        // persist to localStorage so it remains visible across reloads
        try {
          localStorage.setItem('chat_profile_pfp', dataUrl);
        } catch (e) {
          console.warn('Failed to persist profile image to localStorage:', e);
        }
      } catch (e) {
        console.warn('Could not apply profile image:', e);
      }
      closeModal('profileModal');
      try { alert('Profile saved (demo)'); } catch (e) {}
    }

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;
        finishSaveWithDataUrl(dataUrl);
      };
      reader.onerror = function () {
        console.warn('Failed reading selected profile image file');
        // still close the modal to avoid blocking UI
        closeModal('profileModal');
        try { alert('Profile saved (demo)'); } catch (e) {}
      };
      reader.readAsDataURL(file);
    } else if (urlInput && urlInput.value && urlInput.value.trim()) {
      // validate a minimal URL-ish string (not strong validation)
      const val = urlInput.value.trim();
      finishSaveWithDataUrl(val);
    } else {
      // Nothing provided: fallback to closing and showing message
      closeModal('profileModal');
      try { alert('Profile saved (demo)'); } catch (e) {}
    }
  };

  function showModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  }

  // sendMessage - sends a simple text message bubble (keeps parity with file bubbles)
  window.sendMessage = function () {
    if (!messageInput) return;
    const text = (messageInput.value || '').trim();
    if (!text) return;
    const msg = document.createElement('div');
    msg.className = 'msg me';
    msg.style.marginBottom = '12px';
    msg.style.maxWidth = '85%';
    msg.style.alignSelf = 'flex-end';
    const bubble = document.createElement('div');
    bubble.style.background = 'var(--bubble-bg, #e9f4f2)';
    bubble.style.padding = '10px';
    bubble.style.borderRadius = '12px';
    bubble.style.display = 'flex';
    bubble.style.flexDirection = 'column';
    bubble.style.gap = '8px';
    bubble.textContent = text;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.style.opacity = '0.7';
    meta.style.fontSize = '12px';
    meta.style.alignSelf = 'flex-end';
    meta.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    bubble.appendChild(meta);
    msg.appendChild(bubble);
    if (messagesContainer) {
      messagesContainer.appendChild(msg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
      document.body.appendChild(msg);
    }
    messageInput.value = '';
  };

  // Optional: allow pressing Enter to send (Shift+Enter to newline)
  if (messageInput) {
    messageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ----------------- Profile image application helpers -----------------

  // Apply a data URL or remote URL to all avatar/profile-picture UI elements.
  // This function attempts to cover common selectors and both <img> and background-image cases.
  function applyProfileImageToAll(src) {
    if (!src) return;

    // Common img selectors
    const imgSelectors = [
      'img.profile-pic',
      'img.pfp',
      'img.avatar',
      'img.user-avatar',
      '#profileAvatar',
      'img[data-role="avatar"]',
      '.profile-thumb img',
      '.sidebar .avatar img',
      '.topbar .avatar img'
    ];

    imgSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(img => {
        try {
          img.src = src;
        } catch (e) {
          // fallback: set attribute
          img.setAttribute('src', src);
        }
      });
    });

    // Non-img elements that use background-image for avatars
    const bgSelectors = [
      '.profile-pic',
      '.pfp',
      '.avatar',
      '.user-avatar',
      '.profile-thumb',
      '.sidebar .avatar',
      '.topbar .avatar'
    ];
    bgSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // skip elements that are <img> (already handled)
        if (el.tagName && el.tagName.toLowerCase() === 'img') return;
        try {
          el.style.backgroundImage = `url("${src}")`;
          el.style.backgroundSize = el.style.backgroundSize || 'cover';
          el.style.backgroundPosition = el.style.backgroundPosition || 'center';
        } catch (e) {
          // ignore
        }
      });
    });

    // Also try replacing placeholders like <svg> avatars or data-image attributes
    document.querySelectorAll('[data-avatar-src]').forEach(el => {
      try { el.setAttribute('data-avatar-src', src); } catch (e) {}
    });

    // If there is a single prominent profile picture id/class commonly used, set it explicitly
    const explicitIds = ['profilePic', 'pfp', 'avatarImg'];
    explicitIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName && el.tagName.toLowerCase() === 'img') {
        try { el.src = src; } catch (e) { el.setAttribute('src', src); }
      } else {
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundSize = el.style.backgroundSize || 'cover';
        el.style.backgroundPosition = el.style.backgroundPosition || 'center';
      }
    });
  }

});

/* app.js - appended phone auth script (public/app.js) */

// public/app.js

document.addEventListener('DOMContentLoaded', () => {
  const phoneContinueBtn = document.getElementById('phoneContinueBtn');
  const googleBtn = document.getElementById('googleBtn');
  const facebookBtn = document.getElementById('facebookBtn');
  const instagramBtn = document.getElementById('instagramBtn');

  phoneContinueBtn.addEventListener('click', handlePhoneLogin);
  googleBtn.addEventListener('click', () => window.location.href = '/auth/google');
  facebookBtn.addEventListener('click', () => window.location.href = '/auth/facebook');
  instagramBtn.addEventListener('click', () => window.location.href = '/auth/instagram');
});

async function handlePhoneLogin() {
  const countryCode = document.getElementById('countryCode').value;
  const phoneNumber = document.getElementById('phoneNumber').value.trim();

  if (!phoneNumber) {
    alert('Please enter your phone number');
    return;
  }

  const payload = { countryCode, phoneNumber };

  try {
    const res = await fetch('/auth/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.message || 'Failed to request OTP');
      return;
    }

    // Server says OTP sent. Prompt user to enter it (simple flow).
    const otp = prompt('Enter the OTP we sent to your phone (for demo, check server logs):');
    if (!otp) {
      alert('OTP required');
      return;
    }

    const verifyRes = await fetch('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode, phoneNumber, otp }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      alert(verifyData?.message || 'OTP verification failed');
      return;
    }

    // Verified successfully. You might redirect to dashboard.
    alert('Login successful! Welcome, ' + (verifyData.user?.phone || 'user'));
    // example: window.location.href = '/profile';
  } catch (err) {
    console.error(err);
    alert('Network error');
  }
}