// Social Hub - WhatsApp Style Frontend with Multimedia

let token = localStorage.getItem('token') || '';
let me = JSON.parse(localStorage.getItem('me') || 'null');
let socket;
let users = [];
let onlineUsers = new Set();
let currentPeer = null;
let peerConnection = null;
let localStream = null;
let currentCallPeer = null;
let rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let pendingIceCandidates = [];

// Fetch ICE configuration from server (includes TURN servers)
async function fetchIceConfig() {
  try {
    const data = await api('/api/config/rtc');
    if (data.iceServers && data.iceServers.length > 0) {
      rtcConfig = { iceServers: data.iceServers };
      console.log('ICE config loaded:', rtcConfig);
    }
  } catch (err) {
    console.warn('Failed to fetch ICE config, using defaults:', err.message);
  }
}
let chats = [];
let activeTab = 'chats';
let typingTimeout = null;
let isTyping = false;
let stories = [];
let voiceRecorder = null;
let voiceMediaRecorder = null;
let voiceChunks = [];
let isRecording = false;
let replyToMessage = null;
let editingMessage = null;
let groups = [];
let currentGroup = null;
let storyViewerList = [];
let storyViewerIndex = 0;
let deferredInstallPrompt = null;





let posts = [];

// Helper to get DOM elements
const el = (id) => document.getElementById(id);

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function forceInlinePlayback(mediaEl, { showControls = true } = {}) {
  if (!mediaEl) return;
  mediaEl.setAttribute('playsinline', '');
  mediaEl.setAttribute('webkit-playsinline', '');
  mediaEl.setAttribute('x-webkit-airplay', 'deny');
  mediaEl.setAttribute('controlslist', 'nofullscreen noremoteplayback nodownload');
  mediaEl.disablePictureInPicture = true;
  if ('disableRemotePlayback' in mediaEl) {
    mediaEl.disableRemotePlayback = true;
  }
  if (showControls) mediaEl.controls = true;
}

// Elements
const authSection = el('authSection');
const appSection = el('appSection');
const authForm = el('authForm');
const authStatus = el('authStatus');
const sidebarAvatar = el('sidebarAvatar');
const sidebarUsername = el('sidebarUsername');
const sidebarDescription = el('sidebarDescription');
const editProfileBtn = el('editProfileBtn');
const usersList = el('usersList');
const userSearch = el('userSearch');
const chatsList = el('chatsList');
const userSearchInput = el('userSearchInput');
const groupsList = el('groupsList');
const createGroupBtn = el('createGroupBtn');
const messagesEl = el('messages');
const messageForm = el('messageForm');
const messageInput = el('messageInput');
const noChatSelected = el('noChatSelected');
const activeChat = el('activeChat');
const chatUsername = el('chatUsername');
const chatAvatar = el('chatAvatar');
const voiceCallBtn = el('voiceCallBtn');
const videoCallBtn = el('videoCallBtn');
const backToChatsBtn = el('backToChatsBtn');
const endCallBtn = el('endCallBtn');
const localVideo = el('localVideo');
const remoteVideo = el('remoteVideo');
const callModal = el('callModal');
const callUsername = el('callUsername');
const callAvatar = el('callAvatar');
const callStatus = el('callStatus');
const incomingCallActions = el('incomingCallActions');
const acceptCallBtn = el('acceptCallBtn');
const rejectCallBtn = el('rejectCallBtn');
const chatStatus = el('chatStatus');
const storiesList = el('storiesList');
const storyUpload = el('storyUpload');
const storyCaption = el('storyCaption');
const storyModal = el('storyModal');
const closeStoryBtn = el('closeStoryBtn');
const storyImage = el('storyImage');
const storyVideo = el('storyVideo');
const storyViewerAvatar = el('storyViewerAvatar');
const storyViewerUsername = el('storyViewerUsername');
const storyViewerTime = el('storyViewerTime');
const storyViewerCaption = el('storyViewerCaption');
const attachBtn = el('attachBtn');
const attachmentPopup = el('attachmentPopup');
const imageInput = el('imageInput');
const videoInput = el('videoInput');
const voiceInput = el('voiceInput');
const sendBtn = el('sendBtn');
const voiceRecordBtn = el('voiceRecordBtn');
const replyBar = el('replyBar');
const messageOptions = el('messageOptions');
const searchBar = el('searchBar');
const searchInput = el('searchInput');
const searchBtn = el('searchBtn');
const closeSearchBtn = el('closeSearchBtn');
const messageSearchResultsEl = el('searchResults');
const pinnedMessage = el('pinnedMessage');
const pinnedText = el('pinnedText');
const pinnedTime = el('pinnedTime');
const pinMsgBtn = el('pinMsgBtn');
const unpinMsgBtn = el('unpinMsgBtn');


const postsFeed = el('postsFeed');
const quickActions = el('quickActions');
const chatMenuBtn = el('chatMenuBtn');
const chatSettingsMenu = el('chatSettingsMenu');
const muteChatBtn = el('muteChatBtn');
const archiveChatBtn = el('archiveChatBtn');
const pinChatBtn = el('pinChatBtn');
const blockUserBtn = el('blockUserBtn');
const notifToggle = el('notifToggle');
const soundToggle = el('soundToggle');
const vibrateToggle = el('vibrateToggle');
const storyPrevBtn = el('storyPrevBtn');
const storyNextBtn = el('storyNextBtn');
const myStoriesSection = el('myStoriesSection');
const myStoriesList = el('myStoriesList');
const storyReactions = el('storyReactions');
const storyReplyInput = el('storyReplyInput');
const storyReplySend = el('storyReplySend');
const storyReplyContainer = el('storyReplyContainer');
const storyEmojiPicker = el('storyEmojiPicker');
const storyReactBtn = el('storyReactBtn');
const storyHighlightBtn = el('storyHighlightBtn');
const storyViewersBtn = el('storyViewersBtn');
const storyViewCount = el('storyViewCount');
const highlightsSection = el('highlightsSection');
const highlightsList = el('highlightsList');
const installBanner = el('installBanner');
const installBannerText = el('installBannerText');
const installAppBtn = el('installAppBtn');
const dismissInstallBtn = el('dismissInstallBtn');

let currentPinnedMessage = null;
let allMessages = []; // Store all loaded messages for search
let myStories = []; // Store current user's stories
let highlights = []; // Store highlights
let currentStory = null; // Currently viewing story
const STORY_MEDIA_MAX_RETRIES = 2;
let storyImageRetryCount = 0;
let storyVideoRetryCount = 0;
let storyImageRetryTimer = null;
let storyVideoRetryTimer = null;
let activeStoryMediaKey = '';
let storyVideoSourceCandidates = [];
let storyVideoSourceIndex = 0;
let peerKeys = {};
let chatSummaries = new Map();
let blockedUsers = new Set(JSON.parse(localStorage.getItem('blockedUsers') || '[]'));
let mutedUsers = new Set(JSON.parse(localStorage.getItem('mutedUsers') || '[]'));
let archivedUsers = new Set(JSON.parse(localStorage.getItem('archivedUsers') || '[]'));
let pinnedChats = new Set(JSON.parse(localStorage.getItem('pinnedChats') || '[]'));

forceInlinePlayback(localVideo, { showControls: false });
forceInlinePlayback(remoteVideo, { showControls: false });
forceInlinePlayback(storyVideo, { showControls: true });
let pendingMessageQueue = JSON.parse(localStorage.getItem('pendingMessageQueue') || '[]');
let pendingMessageTimers = new Map();
let currentMessagesCursor = null;
let hasMoreMessages = false;
let loadingOlderMessages = false;
let loadedPeerId = null;
let lastTypingResetTimeout = null;
let userSearchTerm = '';


const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{"enabled":false,"sound":true,"vibrate":false}');
let audioCtx = null;
let ringtoneInterval = null;
let lastMessageToneAt = 0;
let lastQueueNoticeAt = 0;

function isNetworkOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function getAudioCtx() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

function playTone(frequency = 880, duration = 0.08, gainValue = 0.03, type = 'sine') {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playMessageTone() {
  if (!notificationSettings.sound) return;
  const now = Date.now();
  if (now - lastMessageToneAt < 250) return;
  lastMessageToneAt = now;
  playTone(900, 0.09, 0.03, 'triangle');
}

function playRingtoneBurst() {
  playTone(740, 0.18, 0.028, 'sine');
  setTimeout(() => playTone(988, 0.22, 0.03, 'sine'), 200);
}

function startIncomingRingtone() {
  if (!notificationSettings.sound) return;
  stopIncomingRingtone();
  playRingtoneBurst();
  ringtoneInterval = setInterval(playRingtoneBurst, 1600);
}

function stopIncomingRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

// Encryption utilities using Web Crypto API
const Encryption = {
  async generateKey() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async exportKey(key) {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  },

  async importKey(keyStr) {
    const keyData = Uint8Array.from(atob(keyStr), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(text, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    return {
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    };
  },

  async decrypt(encrypted, key) {
    if (!encrypted || !encrypted.iv || !encrypted.data) return null;
    try {
      const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
      const data = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('Decryption failed:', e);
      return null;
    }
  }
};

// IndexedDB for offline message storage
const DB_NAME = 'SocialHubDB';
const DB_VERSION = 1;
let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Messages store
      if (!database.objectStoreNames.contains('messages')) {
        const messagesStore = database.createObjectStore('messages', { keyPath: 'id' });
        messagesStore.createIndex('peerId', 'peerId', { unique: false });
        messagesStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Users store
      if (!database.objectStoreNames.contains('users')) {
        database.createObjectStore('users', { keyPath: 'id' });
      }
      
      // Keys store for encryption
      if (!database.objectStoreNames.contains('keys')) {
        database.createObjectStore('keys', { keyPath: 'peerId' });
      }
    };
  });
}

async function saveMessage(message) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const request = store.put(message);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getMessages(peerId) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('peerId');
    const request = index.getAll(IDBKeyRange.only(peerId));
    request.onsuccess = () => {
      const messages = request.result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveUser(user) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getUser(id) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save encrypted peer key
async function savePeerKey(peerId, key) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    const store = tx.objectStore('keys');
    const request = store.put({ peerId, key });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getPeerKeyFromDB(peerId) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readonly');
    const store = tx.objectStore('keys');
    const request = store.get(peerId);
    request.onsuccess = () => resolve(request.result?.key);
    request.onerror = () => reject(request.error);
  });
}

// Initialize IndexedDB
initDB().catch(console.error);

// Emoji picker functionality
const emojiBtn = el('emojiBtn');
const emojiPicker = el('emojiPicker');

emojiBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker?.classList.toggle('hidden');
  attachmentPopup?.classList.add('hidden');
});

document.addEventListener('click', () => {
  emojiPicker?.classList.add('hidden');
});

emojiPicker?.addEventListener('click', (e) => {
  e.stopPropagation();
  const emoji = e.target.closest('.emoji-item');
  if (emoji) {
    messageInput.value += emoji.dataset.emoji;
    messageInput.focus();
  }
});

// Emoji autocomplete
messageInput?.addEventListener('input', () => {
  const text = messageInput.value;
  const words = text.split(/\s+/);
  const lastWord = words[words.length - 1];
  
  if (EMOJI_SHORTCUTS[lastWord]) {
    words[words.length - 1] = EMOJI_SHORTCUTS[lastWord];
    // Could show autocomplete popup here
  }
});

// Handle Enter for autocomplete (simple implementation)
messageInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = messageInput.value;
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (EMOJI_SHORTCUTS[lastWord]) {
      words[words.length - 1] = EMOJI_SHORTCUTS[lastWord];
      messageInput.value = words.join(' ');
      e.preventDefault();
    }
  }
});

async function getPeerKey(peerId) {
  if (peerKeys[peerId]) return peerKeys[peerId];
  
  // Try to get key from server or generate new one
  try {
    const data = await api(`/api/keys/${peerId}`);
    if (data.key) {
      const key = await Encryption.importKey(data.key);
      peerKeys[peerId] = key;
      return key;
    }
  } catch (_) {}
  
  // Generate new key and share
  const key = await Encryption.generateKey();
  const keyStr = await Encryption.exportKey(key);
  peerKeys[peerId] = key;
  
  // Share key with peer
  try {
    await api('/api/keys/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: peerId, key: keyStr })
    });
  } catch (_) {}
  
  return key;
}

// Available reactions
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '👎'];

// Common emojis for autocomplete
const EMOJI_SHORTCUTS = {
  ':)': '😊', ':(': '😢', ':D': '😄', ':p': '😛', 
  ':O': '😮', ';(': '😢', ':*': '😘', ':|': '😐',
  '+1': '👍', '-1': '👎', 'fire': '🔥', 'heart': '❤️',
  'lol': '😂', 'wow': '😮', 'sad': '😢'
};

const api = async (path, opts = {}, payload) => {
  // Backward-compatible signature support:
  // api(path, { ...fetchOptions })
  // api(path, 'POST')
  // api(path, 'POST', { ...jsonBody })
  let requestOptions = opts;
  if (typeof opts === 'string') {
    requestOptions = { method: opts };
    if (payload !== undefined) {
      requestOptions.body = payload instanceof FormData ? payload : JSON.stringify(payload);
    }
  } else if (payload !== undefined) {
    requestOptions = { ...opts };
    requestOptions.body = payload instanceof FormData ? payload : JSON.stringify(payload);
  }

  const headers = { ...(requestOptions.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  // Set Content-Type for POST/PUT requests with body (but NOT for FormData)
  if (requestOptions.body && !headers['Content-Type'] && !(requestOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(path, { ...requestOptions, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${data.error || `Request failed (${res.status})`} [${path}]`);
  return data;
};

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function hideInstallBanner() {
  installBanner?.classList.add('hidden');
}

function showInstallBanner(text, buttonLabel = 'Install') {
  if (!installBanner || localStorage.getItem('installBannerDismissed') === '1') return;
  if (installBannerText) installBannerText.textContent = text;
  if (installAppBtn) installAppBtn.textContent = buttonLabel;
  installBanner.classList.remove('hidden');
}

function showInAppBanner(text, kind = 'info', onClick = null) {
  const existing = document.getElementById('inAppBanner');
  if (existing) existing.remove();

  const banner = document.createElement('button');
  banner.id = 'inAppBanner';
  banner.type = 'button';
  banner.textContent = text;
  banner.style.cssText = [
    'position: fixed',
    'top: calc(10px + env(safe-area-inset-top))',
    'left: 50%',
    'transform: translateX(-50%)',
    'z-index: 2600',
    'border: none',
    'border-radius: 999px',
    'padding: 10px 14px',
    'max-width: min(92vw, 520px)',
    'width: max-content',
    'font-size: 14px',
    'font-weight: 600',
    'box-shadow: 0 8px 24px rgba(0,0,0,0.25)',
    'cursor: pointer',
    'color: #fff',
    kind === 'call' ? 'background: #c0392b' : 'background: #128c7e'
  ].join(';');

  banner.addEventListener('click', () => {
    if (typeof onClick === 'function') onClick();
    banner.remove();
  });

  document.body.appendChild(banner);

  setTimeout(() => {
    banner.remove();
  }, kind === 'call' ? 7000 : 3500);
}

function showQueuedMessageNotice() {
  const now = Date.now();
  if (now - lastQueueNoticeAt < 3000) return;
  lastQueueNoticeAt = now;
  showInAppBanner('You are offline. Message queued and will send when online.');
}

function reconnectSocketIfNeeded() {
  if (!token || isNetworkOffline()) return;
  if (!socket) {
    setupSocket();
    return;
  }
  if (socket.disconnected) socket.connect();
}

function setupInstallPrompt() {
  if (!installBanner || !installAppBtn || !dismissInstallBtn) return;

  dismissInstallBtn.addEventListener('click', () => {
    localStorage.setItem('installBannerDismissed', '1');
    hideInstallBanner();
  });

  installAppBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      hideInstallBanner();
      return;
    }

    if (isIosDevice() && !isStandaloneMode()) {
      alert('On iPhone: open Share menu and tap "Add to Home Screen".');
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallBanner('Install Social Hub for a full-screen app experience on your phone.');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallBanner();
  });

  if (isIosDevice() && !isStandaloneMode()) {
    showInstallBanner('Install on iPhone: Share -> Add to Home Screen.', 'How To');
  }
}

// Elements moved to top of file

// Initialize
(async () => {
  renderAuth();
  applySettingsUI();
  setupInstallPrompt();
  if (token && me) {
    try {
      await loadMeProfile();
      await fetchIceConfig();
      setupSocket();
      await refreshUsers();
      await loadChats();
      await loadGroups();
      await loadStories();
      showApp();
    } catch (_err) {
      clearSession();
      renderAuth();
    }
  }
})();

// Render Functions
function renderAuth() {
  if (token && me) {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
  } else {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
  }
}

function showApp() {
  const display = me?.displayName || me?.username || 'User';
  applyAvatar(sidebarAvatar, me?.avatarUrl, display.charAt(0).toUpperCase() || 'U');
  sidebarUsername.textContent = display;
  if (sidebarDescription) {
    sidebarDescription.textContent = me?.description || 'No description';
  }
  setupUserSearch();
}

function applyAvatar(targetEl, avatarUrl, fallbackLabel = 'U') {
  if (!targetEl) return;
  if (avatarUrl) {
    targetEl.style.backgroundImage = `url("${String(avatarUrl).replace(/"/g, '%22')}")`;
    targetEl.style.backgroundSize = 'cover';
    targetEl.style.backgroundPosition = 'center';
    targetEl.textContent = '';
    return;
  }
  targetEl.style.backgroundImage = '';
  targetEl.style.backgroundSize = '';
  targetEl.style.backgroundPosition = '';
  targetEl.textContent = fallbackLabel;
}

function getFilteredUsers() {
  const query = userSearchTerm.trim().toLowerCase();
  if (!query) return users;
  return users.filter((u) => {
    const username = String(u.username || '').toLowerCase();
    const displayName = String(u.displayName || '').toLowerCase();
    const description = String(u.description || '').toLowerCase();
    return username.includes(query) || displayName.includes(query) || description.includes(query);
  });
}

function saveSession(newToken, user) {
  token = newToken;
  me = user;
  localStorage.setItem('token', token);
  localStorage.setItem('me', JSON.stringify(me));
}

function clearSession() {
  token = '';
  me = null;
  localStorage.removeItem('token');
  localStorage.removeItem('me');
}

async function loadMeProfile() {
  if (!token) return;
  try {
    const data = await api('/api/me');
    if (data?.user) {
      me = data.user;
      localStorage.setItem('me', JSON.stringify(me));
      showApp();
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

// Format time
function formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + 
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

function formatStoryTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = (now - d) / 1000;
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

function persistCollections() {
  localStorage.setItem('blockedUsers', JSON.stringify(Array.from(blockedUsers)));
  localStorage.setItem('mutedUsers', JSON.stringify(Array.from(mutedUsers)));
  localStorage.setItem('archivedUsers', JSON.stringify(Array.from(archivedUsers)));
  localStorage.setItem('pinnedChats', JSON.stringify(Array.from(pinnedChats)));
}

function persistQueue() {
  localStorage.setItem('pendingMessageQueue', JSON.stringify(pendingMessageQueue));
}

function persistNotificationSettings() {
  localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
}

function messagePreview(message) {
  if (!message) return 'Click to chat';
  if (message.text) return message.text.slice(0, 48);
  if (message.mediaType) return `[${message.mediaType}]`;
  return 'Message';
}

function updateChatSummary(peerId, message, incoming = false) {
  const existing = chatSummaries.get(peerId) || {
    unread: 0,
    lastMessage: null,
    lastAt: null
  };
  existing.lastMessage = messagePreview(message);
  existing.lastAt = message?.createdAt || new Date().toISOString();
  if (incoming && currentPeer?.id !== peerId && !mutedUsers.has(peerId)) {
    existing.unread += 1;
  }
  if (currentPeer?.id === peerId) existing.unread = 0;
  chatSummaries.set(peerId, existing);
}

function clearUnread(peerId) {
  const existing = chatSummaries.get(peerId);
  if (!existing) return;
  existing.unread = 0;
  chatSummaries.set(peerId, existing);
}

function sortedUsersForChatList() {
  const visible = users.filter((u) => !archivedUsers.has(u.id) && !blockedUsers.has(u.id));
  return visible.sort((a, b) => {
    const aPinned = pinnedChats.has(a.id) ? 1 : 0;
    const bPinned = pinnedChats.has(b.id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aAt = new Date(chatSummaries.get(a.id)?.lastAt || 0).getTime();
    const bAt = new Date(chatSummaries.get(b.id)?.lastAt || 0).getTime();
    return bAt - aAt;
  });
}

async function notifyIncomingMessage(message) {
  if (!message || message.fromUserId === me?.id) return;
  if (mutedUsers.has(message.fromUserId)) return;
  const from = users.find((u) => u.id === message.fromUserId)?.username || message.fromUsername || 'User';

  if (notificationSettings.enabled && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(`@${from}`, { body: messagePreview(message), silent: !notificationSettings.sound });
  }

  const isCurrentChat = currentPeer?.id === message.fromUserId && !document.hidden;
  if (!isCurrentChat) {
    showInAppBanner(`New message from @${from}`);
  }

  playMessageTone();

  if (notificationSettings.vibrate && navigator.vibrate) {
    navigator.vibrate(120);
  }
}

function applySettingsUI() {
  const notifToggle = el('notifToggle');
  const soundToggle = el('soundToggle');
  const vibrateToggle = el('vibrateToggle');
  if (notifToggle) notifToggle.checked = Boolean(notificationSettings.enabled);
  if (soundToggle) soundToggle.checked = Boolean(notificationSettings.sound);
  if (vibrateToggle) vibrateToggle.checked = Boolean(notificationSettings.vibrate);
}

function updateChatControlLabels() {
  if (!currentPeer) return;
  if (muteChatBtn) muteChatBtn.textContent = mutedUsers.has(currentPeer.id) ? 'Unmute' : 'Mute';
  if (archiveChatBtn) archiveChatBtn.textContent = archivedUsers.has(currentPeer.id) ? 'Unarchive' : 'Archive';
  if (pinChatBtn) pinChatBtn.textContent = pinnedChats.has(currentPeer.id) ? 'Unpin' : 'Pin';
  if (blockUserBtn) blockUserBtn.textContent = blockedUsers.has(currentPeer.id) ? 'Unblock' : 'Block';
}

// Tab Navigation
// Tab switching
function switchToTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.tab === tabName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
  
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  const targetTab = document.getElementById(`${tabName}Tab`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
    activeTab = tabName;
    
    if (tabName === 'stories') {
      loadStories();
    } else if (tabName === 'calls') {
      loadCallLogs();
        } else if (tabName === 'posts') {
      loadPosts();
    }
  }
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchToTab(tab.dataset.tab);
  });
});

window.addEventListener('focus', () => {
  if (activeTab === 'stories') {
    loadStories().catch((err) => {
      console.error('Failed to refresh stories on focus:', err);
    });
  }
});

// Users List
async function refreshUsers() {
  const data = await api('/api/users');
  users = data.users;
  renderUsers();
}

// User search functionality
let searchTimeout = null;
let searchResults = [];

async function handleUserSearch(query) {
  if (!query || query.length < 2) {
    // Show all users when search is empty
    try {
      const data = await api('/api/users/search');
      searchResults = data.users || [];
      renderSearchResults();
    } catch (err) {
      console.error('User search failed:', err);
      searchResults = [];
    }
    return;
  }
  
  try {
    const data = await api(`/api/users/search?q=${encodeURIComponent(query)}`);
    searchResults = data.users || [];
    renderSearchResults();
  } catch (err) {
    console.error('User search failed:', err);
    searchResults = [];
  }
}

function renderSearchResults() {
  // If no search query and no results, show regular chat list
  if ((!userSearchInput || !userSearchInput.value.trim()) && searchResults.length === 0) {
    loadChats();
    return;
  }
  
  chatsList.innerHTML = '';
  
  if (searchResults.length === 0) {
    chatsList.innerHTML = '<li class="list-empty">No users found</li>';
    return;
  }
  
  for (const u of searchResults) {
    const li = document.createElement('li');
    li.dataset.userId = u.id;
    
    const item = document.createElement('div');
    item.className = 'list-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'list-item-avatar';
    applyAvatar(avatar, u.avatarUrl, u.username.charAt(0).toUpperCase());
    
    const content = document.createElement('div');
    content.className = 'list-item-content';
    
    const name = document.createElement('div');
    name.className = 'list-item-name';
    name.textContent = u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`;
    
    const preview = document.createElement('span');
    preview.className = 'list-item-preview';
    preview.textContent = 'Click to start chat';
    
    const online = document.createElement('span');
    online.className = 'online-indicator';
    online.style.color = onlineUsers.has(u.id) ? '#00a884' : '#667781';
    online.textContent = onlineUsers.has(u.id) ? '● Online' : '○ Offline';
    
    content.appendChild(name);
    content.appendChild(preview);
    content.appendChild(online);
    item.appendChild(avatar);
    item.appendChild(content);
    li.appendChild(item);
    
    li.onclick = () => selectPeer(u);
    chatsList.appendChild(li);
  }
}

// Set up user search input handler
function setupUserSearch() {
  if (!userSearchInput) return;
  if (userSearchInput.dataset.setup) return;
  userSearchInput.dataset.setup = 'true';
  
  // Load all users initially
  handleUserSearch('');
  
  userSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (!query) {
      // Show all users when search is cleared
      handleUserSearch('');
      return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(() => {
      handleUserSearch(query);
    }, 300);
  });
  
  userSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      userSearchInput.value = '';
      handleUserSearch('');
    }
  });
}

function renderUsers() {
  usersList.innerHTML = '';
  const filteredUsers = getFilteredUsers();
  
  if (filteredUsers.length === 0) {
    usersList.innerHTML = '<li class="list-empty">No users found</li>';
    return;
  }
  
  for (const u of filteredUsers) {
    const li = document.createElement('li');
    li.className = currentPeer?.id === u.id ? 'active' : '';
    
    const item = document.createElement('div');
    item.className = 'list-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'list-item-avatar';
    applyAvatar(avatar, u.avatarUrl, u.username.charAt(0).toUpperCase());
    
    const content = document.createElement('div');
    content.className = 'list-item-content';
    
    const name = document.createElement('div');
    name.className = 'list-item-name';
    name.textContent = u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`;
    
    const status = document.createElement('span');
    status.className = 'list-item-preview';
    status.textContent = onlineUsers.has(u.id) ? 'Online' : 'Last seen recently';
    status.style.color = onlineUsers.has(u.id) ? '#00a884' : '#667781';
    
    content.appendChild(name);
    content.appendChild(status);
    
    item.appendChild(avatar);
    item.appendChild(content);
    li.appendChild(item);
    li.onclick = () => selectPeer(u);
    
    usersList.appendChild(li);
  }
}

// Chats
async function loadChats() {
  chatsList.innerHTML = '';
  
  if (users.length === 0) {
    chatsList.innerHTML = '<li class="list-empty">No chats yet. Add some friends!</li>';
    return;
  }

  // Load per-chat summary (last message + time) lazily.
  await Promise.all(users.map(async (u) => {
    if (chatSummaries.has(u.id)) return;
    try {
      const data = await api(`/api/messages/${u.id}?limit=1`);
      const last = data.messages?.[0] || null;
      chatSummaries.set(u.id, {
        unread: 0,
        lastMessage: messagePreview(last),
        lastAt: last?.createdAt || null
      });
    } catch (_) {
      chatSummaries.set(u.id, { unread: 0, lastMessage: 'Click to chat', lastAt: null });
    }
  }));

  for (const u of sortedUsersForChatList()) {
    const li = document.createElement('li');
    li.dataset.userId = u.id;
    
    const item = document.createElement('div');
    item.className = 'list-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'list-item-avatar';
    applyAvatar(avatar, u.avatarUrl, u.username.charAt(0).toUpperCase());
    
    const content = document.createElement('div');
    content.className = 'list-item-content';
    
    const name = document.createElement('div');
    name.className = 'list-item-name';
    name.textContent = u.displayName ? `${u.displayName} (@${u.username})` : `@${u.username}`;
    
    const preview = document.createElement('span');
    preview.className = 'list-item-preview';
    const summary = chatSummaries.get(u.id);
    preview.textContent = summary?.lastMessage || 'Click to chat';

    const meta = document.createElement('div');
    meta.style.display = 'flex';
    meta.style.flexDirection = 'column';
    meta.style.alignItems = 'flex-end';
    meta.style.gap = '6px';

    const time = document.createElement('span');
    time.className = 'list-item-preview';
    time.textContent = summary?.lastAt ? formatTime(summary.lastAt) : '';
    time.style.fontSize = '11px';

    meta.appendChild(time);

    if ((summary?.unread || 0) > 0) {
      const badge = document.createElement('span');
      badge.textContent = String(summary.unread);
      badge.style.minWidth = '20px';
      badge.style.height = '20px';
      badge.style.borderRadius = '10px';
      badge.style.background = '#00a884';
      badge.style.color = '#fff';
      badge.style.fontSize = '12px';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.padding = '0 6px';
      meta.appendChild(badge);
    }
    
    content.appendChild(name);
    content.appendChild(preview);
    
    item.appendChild(avatar);
    item.appendChild(content);
    item.appendChild(meta);
    li.appendChild(item);
    li.onclick = () => selectPeer(u);
    
    chatsList.appendChild(li);
  }
}

async function loadGroups() {
  if (!groupsList) return;
  try {
    const data = await api('/api/groups');
    groups = data.groups || [];
    renderGroups();
  } catch (err) {
    console.error('Failed to load groups:', err);
  }
}

function renderGroups() {
  if (!groupsList) return;
  groupsList.innerHTML = '';
  if (!groups.length) {
    groupsList.innerHTML = '<li class="list-empty">No groups yet. Create one.</li>';
    return;
  }

  groups.forEach((g) => {
    const li = document.createElement('li');
    li.dataset.groupId = g._id || g.id;
    if (currentGroup && (currentGroup._id || currentGroup.id) === (g._id || g.id)) {
      li.classList.add('active');
    }

    const item = document.createElement('div');
    item.className = 'list-item';

    const avatar = document.createElement('div');
    avatar.className = 'list-item-avatar';
    avatar.textContent = (g.name || 'G').charAt(0).toUpperCase();

    const content = document.createElement('div');
    content.className = 'list-item-content';

    const name = document.createElement('div');
    name.className = 'list-item-name';
    name.textContent = `# ${g.name}`;

    const preview = document.createElement('span');
    preview.className = 'list-item-preview';
    preview.textContent = g.lastMessage?.text || `${(g.members || []).length} members`;

    content.appendChild(name);
    content.appendChild(preview);
    item.appendChild(avatar);
    item.appendChild(content);
    li.appendChild(item);
    li.onclick = () => selectGroup(g);
    groupsList.appendChild(li);
  });
}

async function selectGroup(group) {
  currentGroup = group;
  currentPeer = null;
  chatUsername.textContent = `#${group.name}`;
  applyAvatar(chatAvatar, '', (group.name || 'G').charAt(0).toUpperCase());
  chatStatus.textContent = `${(group.members || []).length} members`;
  chatStatus.style.color = '#667781';

  noChatSelected.classList.add('hidden');
  activeChat.classList.remove('hidden');
  voiceCallBtn.style.display = 'none';
  videoCallBtn.style.display = 'none';
  if (chatMenuBtn) chatMenuBtn.style.display = 'none';
  if (chatSettingsMenu) chatSettingsMenu.classList.add('hidden');

  document.querySelectorAll('.list li').forEach((li) => li.classList.remove('active'));
  const gid = group._id || group.id;
  document.querySelectorAll(`[data-group-id="${gid}"]`).forEach((li) => li.classList.add('active'));

  if (socket) socket.emit('group:join', { groupId: gid });

  try {
    await loadGroupMessages(gid);
  } catch (err) {
    console.error('Failed to load group messages:', err);
    alert(`Failed to load group: ${err.message}`);
  }
}

async function loadGroupMessages(groupId) {
  const data = await api(`/api/groups/${groupId}/messages`);
  const msgs = (data.messages || []).map((m) => ({
    id: m._id?.toString?.() || m.id,
    fromUserId: m.fromUserId?._id?.toString?.() || m.fromUserId?.toString?.() || m.fromUserId,
    fromUsername: m.fromUserId?.username || m.fromUsername || 'User',
    toUserId: groupId,
    groupId,
    text: m.text,
    mediaType: m.mediaType,
    mediaUrl: m.mediaUrl,
    duration: m.duration,
    createdAt: m.createdAt,
    readBy: m.readBy || [],
    reactions: m.reactions || []
  }));
  allMessages = msgs;
  hasMoreMessages = false;
  currentMessagesCursor = null;
  loadedPeerId = `group:${groupId}`;
  renderAllLoadedMessages(true);
}

// Messages
async function selectPeer(user) {
  currentGroup = null;
  currentPeer = user;
  
  appSection.classList.add('active-chat');
  
  chatUsername.textContent = user.displayName ? `${user.displayName} (@${user.username})` : `@${user.username}`;
  applyAvatar(chatAvatar, user.avatarUrl, user.username.charAt(0).toUpperCase());
  chatStatus.textContent = onlineUsers.has(user.id) ? 'Online' : 'Last seen recently';
  chatStatus.style.color = onlineUsers.has(user.id) ? '#00a884' : '#667781';
  voiceCallBtn.style.display = '';
  videoCallBtn.style.display = '';
  if (chatMenuBtn) chatMenuBtn.style.display = '';
  updateChatControlLabels();
  
  noChatSelected.classList.add('hidden');
  activeChat.classList.remove('hidden');
  
  document.querySelectorAll('.list li').forEach(li => {
    li.classList.remove('active');
    if (li.dataset.userId === user.id) {
      li.classList.add('active');
    }
  });
  
  try {
    await loadMessages(user.id);
  } catch (err) {
    console.error('Failed to load messages:', err);
    alert(`Failed to load chat: ${err.message}`);
  }
}

// Backward-compat shim for older cached UI handlers.
function selectUser(user) {
  return selectPeer(user);
}

async function loadMessages(peerId, opts = {}) {
  const { appendOlder = false } = opts;
  const query = new URLSearchParams({ limit: '40' });
  if (appendOlder && currentMessagesCursor) query.set('before', String(currentMessagesCursor));

  const data = await api(`/api/messages/${peerId}?${query.toString()}`);
  const messages = data.messages || [];

  if (!appendOlder) {
    allMessages = messages;
  } else {
    allMessages = [...messages, ...allMessages];
  }

  hasMoreMessages = Boolean(data.hasMore);
  currentMessagesCursor = data.nextBefore || null;
  loadedPeerId = peerId;

  renderAllLoadedMessages(!appendOlder);
  if (allMessages.length) {
    updateChatSummary(peerId, allMessages[allMessages.length - 1], false);
  }
  clearUnread(peerId);
  await loadChats();
  markMessagesAsRead(peerId);
}

function renderAllLoadedMessages(scrollToBottom = false) {
  messagesEl.innerHTML = '';
  let lastDate = null;
  for (const m of allMessages) {
    const msgDate = new Date(m.createdAt).toDateString();
    if (msgDate !== lastDate) {
      addDateSeparator(msgDate);
      lastDate = msgDate;
    }
    addMessage(m);
  }
  if (scrollToBottom) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

async function loadOlderMessages() {
  if (!currentPeer || !hasMoreMessages || loadingOlderMessages || loadedPeerId !== currentPeer.id) return;
  loadingOlderMessages = true;
  const prevHeight = messagesEl.scrollHeight;
  try {
    await loadMessages(currentPeer.id, { appendOlder: true });
    messagesEl.scrollTop = messagesEl.scrollHeight - prevHeight;
  } catch (err) {
    console.error('Failed to load older messages:', err);
  } finally {
    loadingOlderMessages = false;
  }
}

function addDateSeparator(dateStr) {
  const separator = document.createElement('div');
  separator.className = 'date-separator';
  
  let text = '';
  const date = new Date(dateStr);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (dateStr === today) {
    text = 'Today';
  } else if (dateStr === yesterday) {
    text = 'Yesterday';
  } else {
    text = date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }
  
  separator.innerHTML = `<div class="date-separator-line"></div><span class="date-separator-text">${text}</span><div class="date-separator-line"></div>`;
  messagesEl.appendChild(separator);
}

function addMessage(message, update = false) {
  let div = update ? messagesEl.querySelector(`[data-message-id="${message.id}"]`) : null;
  
  if (update && !div) return; // Message not found for update
  
  const isSent = message.fromUserId === me?.id;
  
  if (!div) {
    div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    if (message.callInfo) {
      div.classList.add('call-notification');
    }
    div.dataset.messageId = message.id;
  }
  
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  // Forwarded indicator
  if (message.forwarded) {
    const forwardedDiv = document.createElement('div');
    forwardedDiv.className = 'forwarded-indicator';
    forwardedDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="17 1 21 5 17 9"></polyline>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
    </svg>`;
    const span = document.createElement('span');
    span.textContent = message.forwardedFrom ? `Forwarded from @${message.forwardedFrom}` : 'Forwarded';
    forwardedDiv.appendChild(span);
    bubble.appendChild(forwardedDiv);
  }
  
  // Reply indicator
  if (message.replyTo) {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'reply-indicator';
    replyDiv.innerHTML = `<svg class="reply-indicator-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 17 4 12 9 7"></polyline>
      <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
    </svg>`;
    
    const replyInfo = document.createElement('div');
    replyInfo.style.display = 'flex';
    replyInfo.style.flexDirection = 'column';
    
    const replyUser = document.createElement('span');
    replyUser.className = 'reply-indicator-text';
    replyUser.textContent = `@${message.replyFromUsername || 'User'}`;
    
    const replyPreview = document.createElement('span');
    replyPreview.className = 'reply-indicator-preview';
    replyPreview.textContent = message.replyPreview || 'Message';
    
    replyInfo.appendChild(replyUser);
    replyInfo.appendChild(replyPreview);
    replyDiv.appendChild(replyInfo);
    bubble.appendChild(replyDiv);
  }
  
  // Handle different message types
  if (message.mediaType && message.mediaUrl) {
    if (message.mediaType === 'image') {
      const img = document.createElement('img');
      img.src = resolveMediaSrc(message.mediaUrl);
      img.alt = 'Image';
      bubble.appendChild(img);
    } else if (message.mediaType === 'video') {
      const video = document.createElement('video');
      video.src = resolveMediaSrc(message.mediaUrl);
      forceInlinePlayback(video, { showControls: true });
      bubble.appendChild(video);
    } else if (message.mediaType === 'voice') {
      const voiceDiv = document.createElement('div');
      voiceDiv.className = 'voice-message';
      
      const icon = document.createElement('div');
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      </svg>`;
      
      const wave = document.createElement('div');
      wave.className = 'voice-wave';
      for (let i = 0; i < 5; i++) {
        const span = document.createElement('span');
        wave.appendChild(span);
      }
      
      const duration = document.createElement('span');
      duration.className = 'voice-duration';
      duration.textContent = message.duration || '0:00';
      
      voiceDiv.appendChild(icon);
      voiceDiv.appendChild(wave);
      voiceDiv.appendChild(duration);
      bubble.appendChild(voiceDiv);
    } else if (message.callInfo) {
      // Call notification
      const callDiv = document.createElement('div');
      callDiv.className = 'call-notification-text';
      
      const iconSvg = message.callInfo.type === 'video' ? 
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>` :
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>`;
      
      let callText = '';
      if (message.callInfo.status === 'missed') {
        callDiv.classList.add('missed');
        callText = `Missed ${message.callInfo.type} call`;
      } else if (message.callInfo.status === 'answered') {
        callText = `${message.callInfo.type === 'video' ? 'Video' : 'Voice'} call (${message.callInfo.duration || '0:00'})`;
      } else {
        callText = `Incoming ${message.callInfo.type} call`;
      }
      
      callDiv.innerHTML = `${iconSvg}<span>${callText}</span>`;
      bubble.appendChild(callDiv);
    }
  }
  
  if (message.text) {
    const text = document.createElement('div');
    text.textContent = message.text;
    if (message.edited) {
      const edited = document.createElement('span');
      edited.className = 'edited-indicator';
      edited.textContent = '(edited)';
      text.appendChild(edited);
    }
    bubble.appendChild(text);
  }
  
  // Reactions
  if (message.reactions && message.reactions.length > 0) {
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'message-reactions';
    
    // Group reactions by emoji
    const reactionGroups = {};
    message.reactions.forEach(r => {
      if (!reactionGroups[r.emoji]) {
        reactionGroups[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
      }
      reactionGroups[r.emoji].count++;
      reactionGroups[r.emoji].users.push(r.userId);
    });
    
    Object.values(reactionGroups).forEach(group => {
      const badge = document.createElement('span');
      badge.className = 'reaction-badge';
      badge.innerHTML = `<span class="reaction-emoji">${group.emoji}</span><span class="reaction-count">${group.count}</span>`;
      reactionsDiv.appendChild(badge);
    });
    
    bubble.appendChild(reactionsDiv);
  }
  
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  
  // Hide meta for call notifications
  if (message.callInfo) {
    meta.style.display = 'none';
  }
  
  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = formatTime(message.createdAt);
  
  meta.appendChild(time);
  
  if (isSent) {
    const ticks = document.createElement('span');
    ticks.className = 'read-ticks';
    if (message.sendState === 'sending') {
      ticks.textContent = 'Sending...';
      ticks.style.color = '#667781';
    } else if (message.sendState === 'failed') {
      ticks.textContent = 'Failed';
      ticks.style.color = '#f15c6d';
    } else if (message.readBy && message.readBy.length > 0) {
      ticks.innerHTML = '✓✓';
      ticks.style.color = '#53bdeb';
    } else if (message.deliveredAt) {
      ticks.innerHTML = '✓✓';
      ticks.style.color = '#667781';
    } else {
      ticks.innerHTML = '✓';
      ticks.style.color = '#667781';
    }
    meta.appendChild(ticks);

    if (message.sendState === 'failed' && message.clientTempId) {
      const resendBtn = document.createElement('button');
      resendBtn.type = 'button';
      resendBtn.textContent = 'Resend';
      resendBtn.style.marginLeft = '8px';
      resendBtn.style.border = 'none';
      resendBtn.style.background = 'transparent';
      resendBtn.style.color = '#00a884';
      resendBtn.style.cursor = 'pointer';
      resendBtn.onclick = (e) => {
        e.stopPropagation();
        resendPendingMessage(message.clientTempId);
      };
      meta.appendChild(resendBtn);
    }
  }
  
  bubble.appendChild(meta);
  
  // Click to show quick actions (skip for call notifications)
  bubble.onclick = (e) => {
    e.stopPropagation();
    if (!message.callInfo) {
      showQuickActions(message, bubble);
    }
  };
  
  div.innerHTML = '';
  div.appendChild(bubble);
  
  if (!update) {
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// Message options popup
let currentOptionsMessage = null;

function showMessageOptions(message, bubble) {
  const options = document.getElementById('messageOptions');
  currentOptionsMessage = message;
  
  // Position the popup
  const rect = bubble.getBoundingClientRect();
  options.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  options.style.left = `${rect.left + rect.width / 2}px`;
  
  options.classList.remove('hidden');
  
  // Hide edit option for received messages
  const editBtn = options.querySelector('[data-action="edit"]');
  editBtn.style.display = message.fromUserId === me?.id ? 'flex' : 'none';
  
  // Hide delete option for received messages
  const deleteBtn = options.querySelector('[data-action="delete"]');
  deleteBtn.style.display = message.fromUserId === me?.id ? 'flex' : 'none';
}

function hideMessageOptions() {
  document.getElementById('messageOptions').classList.add('hidden');
  currentOptionsMessage = null;
}

// Reply bar
function showReplyBar(message) {
  const replyBar = document.getElementById('replyBar');
  document.getElementById('replyUsername').textContent = `@${message.fromUsername || 'User'}`;
  document.getElementById('replyPreview').textContent = message.text || (message.mediaType ? `[${message.mediaType}]` : 'Message');
  replyBar.classList.remove('hidden');
  replyToMessage = message;
  messageInput.focus();
}

function hideReplyBar() {
  document.getElementById('replyBar').classList.add('hidden');
  replyToMessage = null;
}

document.getElementById('cancelReply').addEventListener('click', hideReplyBar);

// Message options event listeners
document.querySelectorAll('.option-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!currentOptionsMessage) return;
    
    const action = btn.dataset.action;
    
    switch (action) {
      case 'reply':
        showReplyBar(currentOptionsMessage);
        break;
        
      case 'forward':
        // Forward message - select recipient
        const recipient = prompt('Enter username to forward to:');
        if (recipient) {
          try {
            const usersData = await api('/api/users');
            const user = usersData.users.find(u => u.username.toLowerCase() === recipient.toLowerCase());
            if (user) {
              await api(`/api/messages/${currentOptionsMessage.id}/forward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toUserId: user.id })
              });
              alert('Message forwarded!');
            } else {
              alert('User not found');
            }
          } catch (err) {
            alert('Failed to forward: ' + err.message);
          }
        }
        break;
        
      case 'edit':
        if (currentOptionsMessage.fromUserId !== me?.id) return;
        const newText = prompt('Edit message:', currentOptionsMessage.text);
        if (newText !== null) {
          try {
            await api(`/api/messages/${currentOptionsMessage.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: newText })
            });
          } catch (err) {
            alert('Failed to edit: ' + err.message);
          }
        }
        break;
        
      case 'delete':
        if (currentOptionsMessage.fromUserId !== me?.id) return;
        if (confirm('Delete message for everyone?')) {
          try {
            await api(`/api/messages/${currentOptionsMessage.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deleteForAll: true })
            });
          } catch (err) {
            alert('Failed to delete: ' + err.message);
          }
        }
        break;
    }
    
    hideMessageOptions();
  });
});

// Reaction buttons
document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!currentOptionsMessage) return;
    
    const emoji = btn.dataset.emoji;
    
    try {
      await api(`/api/messages/${currentOptionsMessage.id}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
    
    hideMessageOptions();
  });
});

// Close message options on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.message-options')) {
    hideMessageOptions();
  }
});

// Attachment handling
attachBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  attachmentPopup.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  attachmentPopup.classList.add('hidden');
});

imageInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    sendMediaMessage(e.target.files[0], 'image');
    attachmentPopup.classList.add('hidden');
  }
});

videoInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    sendMediaMessage(e.target.files[0], 'video');
    attachmentPopup.classList.add('hidden');
  }
});

voiceInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    sendMediaMessage(e.target.files[0], 'voice');
    attachmentPopup.classList.add('hidden');
  }
});

document.getElementById('attachImage').addEventListener('click', () => {
  imageInput.click();
});

document.getElementById('attachVideo').addEventListener('click', () => {
  videoInput.click();
});

document.getElementById('attachVoice').addEventListener('click', () => {
  voiceInput.click();
});

document.getElementById('attachGif')?.addEventListener('click', () => {
  gifInput.click();
});

gifInput?.addEventListener('change', async () => {
  const file = gifInput.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/gif')) {
    alert('Please select a GIF file');
    return;
  }
  
  await sendMediaMessage(file, 'gif');
  gifInput.value = '';
});

// Voice recording
voiceRecordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    startVoiceRecording();
  } else {
    stopVoiceRecording();
  }
});

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceMediaRecorder = new MediaRecorder(stream);
    voiceChunks = [];
    
    voiceMediaRecorder.ondataavailable = (e) => {
      voiceChunks.push(e.data);
    };
    
    voiceMediaRecorder.onstop = () => {
      const blob = new Blob(voiceChunks, { type: 'audio/webm' });
      sendMediaMessage(blob, 'voice');
      stream.getTracks().forEach(track => track.stop());
    };
    
    voiceMediaRecorder.start();
    isRecording = true;
    voiceRecordBtn.classList.add('recording');
    messageInput.placeholder = 'Recording...';
    sendBtn.classList.add('hidden');
  } catch (err) {
    console.error('Failed to start recording:', err);
    alert('Could not access microphone');
  }
}

function stopVoiceRecording() {
  if (voiceMediaRecorder && isRecording) {
    voiceMediaRecorder.stop();
    isRecording = false;
    voiceRecordBtn.classList.remove('recording');
    messageInput.placeholder = 'Type a message...';
    sendBtn.classList.add('hidden');
    voiceRecordBtn.classList.remove('hidden');
  }
}

async function sendMediaMessage(file, mediaType) {
  if (currentGroup) {
    alert('Media upload for groups will be added next.');
    return;
  }
  if (!currentPeer || !socket) {
    alert('Select a user to chat first');
    return;
  }
  
  try {
    // Upload the file first
    const formData = new FormData();
    formData.append('media', file);
    
    const uploadRes = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    
    if (!uploadRes.ok) throw new Error('Upload failed');
    const { url } = await uploadRes.json();
    
    // Get duration for voice messages
    let duration = null;
    if (mediaType === 'voice') {
      duration = await getAudioDuration(file);
    }
    
    // Send the media message
    const payload = {
      toUserId: currentPeer.id,
      mediaType,
      mediaUrl: url,
      duration
    };
    const clientTempId = tempId();
    queueLocalMessage(payload, clientTempId);
    emitOrQueueMessage(payload, clientTempId);
  } catch (err) {
    console.error('Failed to send media:', err);
    alert('Failed to send media message');
  }
  
  // Reset file inputs
  imageInput.value = '';
  videoInput.value = '';
  voiceInput.value = '';
}

function getAudioDuration(blob) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => {
      const mins = Math.floor(audio.duration / 60);
      const secs = Math.floor(audio.duration % 60);
      resolve(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    audio.onerror = () => resolve('0:00');
  });
}

// Typing indicator
function startTyping() {
  if (!socket || !currentPeer) return;
  
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing_start', { toUserId: currentPeer.id });
  }
  
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('typing_stop', { toUserId: currentPeer.id });
  }, 1000);
}

function stopTyping() {
  if (!socket || !currentPeer || !isTyping) return;
  isTyping = false;
  socket.emit('typing_stop', { toUserId: currentPeer.id });
  if (typingTimeout) clearTimeout(typingTimeout);
}

function markMessagesAsRead(peerId) {
  if (!socket) return;
  
  const unreadMessages = [];
  messagesEl.querySelectorAll('.message.received').forEach(msgDiv => {
    const ticks = msgDiv.querySelector('.read-ticks');
    if (!ticks || ticks.textContent === '✓') {
      unreadMessages.push(msgDiv.dataset.messageId);
    }
  });
  
  if (unreadMessages.length > 0) {
    socket.emit('mark_read', { 
      messageIds: unreadMessages, 
      fromUserId: peerId 
    });
    
    unreadMessages.forEach(msgId => {
      const msgDiv = messagesEl.querySelector(`[data-message-id="${msgId}"]`);
      if (msgDiv) {
        const ticks = msgDiv.querySelector('.read-ticks');
        if (ticks) {
          ticks.innerHTML = '✓✓';
          ticks.style.color = '#53bdeb';
        }
      }
    });
  }
}

// Stories
async function loadStories() {
  const [publicRes, mineRes, highlightRes] = await Promise.allSettled([
    api('/api/stories'),
    api('/api/stories/mine'),
    api('/api/stories/highlights')
  ]);

  if (publicRes.status === 'fulfilled') {
    stories = publicRes.value?.stories || [];
  } else {
    stories = [];
    console.error('Failed to load /api/stories:', publicRes.reason);
  }

  if (mineRes.status === 'fulfilled') {
    myStories = mineRes.value?.stories || [];
  } else {
    myStories = [];
    console.error('Failed to load /api/stories/mine:', mineRes.reason);
  }

  if (highlightRes.status === 'fulfilled') {
    highlights = highlightRes.value?.stories || [];
  } else {
    highlights = [];
    console.error('Failed to load /api/stories/highlights:', highlightRes.reason);
  }

  renderHighlights();
  renderMyStories();
  renderStories();
}

// Highlights
function renderHighlights() {
  if (!highlightsSection || !highlightsList) return;
  
  highlightsList.innerHTML = '';
  
  if (highlights.length === 0) {
    highlightsSection.classList.add('hidden');
    return;
  }
  
  highlightsSection.classList.remove('hidden');
  
  highlights.forEach(story => {
    const storyItem = document.createElement('div');
    storyItem.className = 'story-item';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'story-avatar';
    
    const ring = document.createElement('div');
    ring.className = 'story-ring my-story-ring';
    
    const inner = document.createElement('div');
    inner.className = 'story-ring-inner';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = story.username?.charAt(0).toUpperCase() || 'U';
    
    inner.appendChild(avatar);
    ring.appendChild(inner);
    avatarDiv.appendChild(ring);
    
    const info = document.createElement('div');
    info.className = 'story-info';
    
    const username = document.createElement('div');
    username.className = 'story-username';
    username.textContent = story.highlightTitle || story.username || 'Highlight';
    
    info.appendChild(username);
    
    storyItem.appendChild(avatarDiv);
    storyItem.appendChild(info);
    
    bindStoryOpen(storyItem, story, highlights);
    
    highlightsList.appendChild(storyItem);
  });
}

function renderMyStories() {
  if (!myStoriesSection || !myStoriesList) return;
  
  myStoriesList.innerHTML = '';
  
  if (myStories.length === 0) {
    myStoriesSection.classList.add('hidden');
    return;
  }
  
  myStoriesSection.classList.remove('hidden');
  
  // Group stories by user (in case user has multiple)
  const myStoriesByUser = {};
  myStories.forEach(story => {
    if (!myStoriesByUser[story.userId]) {
      myStoriesByUser[story.userId] = [];
    }
    myStoriesByUser[story.userId].push(story);
  });
  
  Object.entries(myStoriesByUser).forEach(([userId, userStories]) => {
    const latestStory = userStories[0];
    
    const storyItem = document.createElement('div');
    storyItem.className = 'story-item';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'story-avatar';
    
    // WhatsApp-style ring - green gradient for own stories
    const ring = document.createElement('div');
    ring.className = 'story-ring my-story-ring';
    
    const inner = document.createElement('div');
    inner.className = 'story-ring-inner';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = latestStory.username?.charAt(0).toUpperCase() || 'U';
    
    inner.appendChild(avatar);
    ring.appendChild(inner);
    avatarDiv.appendChild(ring);
    
    const info = document.createElement('div');
    info.className = 'story-info';
    
    const username = document.createElement('div');
    username.className = 'story-username';
    username.textContent = 'My Story';
    
    const time = document.createElement('span');
    time.className = 'story-time';
    time.textContent = `${userStories.length} story${userStories.length > 1 ? 'ies' : ''} • ${formatStoryTime(latestStory.createdAt)}`;
    
    info.appendChild(username);
    info.appendChild(time);
    
    storyItem.appendChild(avatarDiv);
    storyItem.appendChild(info);
    
    bindStoryOpen(storyItem, latestStory, userStories);
    
    myStoriesList.appendChild(storyItem);
  });
}

function renderStories() {
  storiesList.innerHTML = '';
  
  if (stories.length === 0) {
    storiesList.innerHTML = '<p style="text-align:center;color:#667781;padding:20px;">No stories yet. Be the first to post!</p>';
    return;
  }
  
  const storiesByUser = {};
  stories.forEach(story => {
    if (!storiesByUser[story.userId]) {
      storiesByUser[story.userId] = [];
    }
    storiesByUser[story.userId].push(story);
  });
  
  Object.entries(storiesByUser).forEach(([userId, userStories]) => {
    const latestStory = userStories[0];
    const hasUnviewed = userStories.some(s => !s.viewed || !s.viewed.includes(me?.id));
    
    const storyItem = document.createElement('div');
    storyItem.className = 'story-item';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'story-avatar';
    
    const ring = document.createElement('div');
    ring.className = `story-ring ${hasUnviewed ? '' : 'viewed'}`;
    
    const inner = document.createElement('div');
    inner.className = 'story-ring-inner';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = latestStory.username?.charAt(0).toUpperCase() || 'U';
    
    inner.appendChild(avatar);
    ring.appendChild(inner);
    avatarDiv.appendChild(ring);
    
    const info = document.createElement('div');
    info.className = 'story-info';
    
    const username = document.createElement('div');
    username.className = 'story-username';
    username.textContent = `@${latestStory.username || 'User'}`;
    
    const time = document.createElement('span');
    time.className = 'story-time';
    time.textContent = `${formatStoryTime(latestStory.createdAt)} • ${userStories.length} story${userStories.length > 1 ? 'ies' : ''}`;
    
    info.appendChild(username);
    info.appendChild(time);
    
    storyItem.appendChild(avatarDiv);
    storyItem.appendChild(info);
    
    bindStoryOpen(storyItem, latestStory, userStories);
    
    storiesList.appendChild(storyItem);
  });
}

function bindStoryOpen(targetEl, story, list) {
  if (!targetEl) return;
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    openStoryViewer(story, list);
    setTimeout(() => { opened = false; }, 250);
  };
  targetEl.addEventListener('click', open);
  targetEl.addEventListener('touchend', (e) => {
    e.preventDefault();
    open();
  }, { passive: false });
}

function normalizeStory(story) {
  if (!story || typeof story !== 'object') return null;
  const id = story.id || story._id || null;
  const mediaUrl = String(story.mediaUrl || story.url || '').trim();
  let mediaType = String(story.mediaType || '').trim().toLowerCase();
  if (mediaType.startsWith('video/')) mediaType = 'video';
  if (mediaType.startsWith('image/')) mediaType = 'image';
  if (!mediaType) {
    if (/\.(mp4|webm|ogg|mov)$/i.test(mediaUrl)) mediaType = 'video';
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(mediaUrl)) mediaType = 'image';
  }
  return { ...story, id, mediaUrl, mediaType };
}

function resolveMediaSrc(mediaUrl) {
  if (!mediaUrl) return '';
  
  // Trim and convert to string to handle any whitespace issues
  const url = String(mediaUrl).trim();
  if (!url) return '';
  
  // Handle already complete URLs
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return `${window.location.origin}/${url}`;
}

function resolveStoryMediaSrc(story) {
  const baseUrl = resolveMediaSrc(story?.mediaUrl || '');
  if (!baseUrl || !baseUrl.includes('cloudinary.com')) return baseUrl;

  // Force widely-supported story delivery for mobile devices.
  if ((story?.mediaType === 'video' || baseUrl.includes('/video/upload/')) && baseUrl.includes('/video/upload/')) {
    return baseUrl.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,ac_aac,q_auto:good/');
  }
  if ((story?.mediaType === 'image' || baseUrl.includes('/image/upload/')) && baseUrl.includes('/image/upload/')) {
    return baseUrl.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
  }

  return baseUrl;
}

function buildStoryVideoCandidates(story) {
  const original = resolveMediaSrc(story?.mediaUrl || '');
  if (!original) return [];

  const candidates = [];
  if (original.includes('cloudinary.com') && original.includes('/video/upload/')) {
    candidates.push(original.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,ac_aac,q_auto:good/'));
    candidates.push(original.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,ac_aac/'));
    candidates.push(original.replace('/video/upload/', '/video/upload/q_auto:good/'));
  }
  candidates.push(original);
  return [...new Set(candidates)];
}

function inferStoryMediaKind(mediaType, mediaUrl) {
  const urlExt = String(mediaUrl || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase();
  const videoExts = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v']);
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
  const normalizedUrl = String(mediaUrl || '').toLowerCase();

  if (imageExts.has(urlExt)) return { kind: 'image', urlExt };
  if (videoExts.has(urlExt)) return { kind: 'video', urlExt };
  if (normalizedUrl.includes('/video/upload/')) return { kind: 'video', urlExt };
  if (normalizedUrl.includes('/image/upload/')) return { kind: 'image', urlExt };

  if (mediaType === 'image') return { kind: 'image', urlExt };
  if (mediaType === 'video') return { kind: 'video', urlExt };
  return { kind: 'unknown', urlExt };
}

function renderStoryAt(index) {
  const story = normalizeStory(storyViewerList[index]);
  if (!story) return;
  const prevStory = currentStory;
  currentStory = story;
  storyViewerIndex = index;
  storyViewerAvatar.textContent = story.username?.charAt(0).toUpperCase() || 'U';
  storyViewerUsername.textContent = `@${story.username || 'User'}`;
  storyViewerTime.textContent = formatStoryTime(story.createdAt);
  storyViewerCaption.textContent = story.caption || '';
  
  // Update view count
  if (storyViewCount) {
    storyViewCount.textContent = story.viewsCount || (story.viewed ? story.viewed.length : 0);
  }
  
  // Render reactions
  renderStoryReactions(story);
  
  // Show/hide reply input (only if not own story)
  if (storyReplyContainer) {
    if (story.userId !== me?.id) {
      storyReplyContainer.classList.remove('hidden');
    } else {
      storyReplyContainer.classList.add('hidden');
    }
  }
  
  // Update highlight button
  if (storyHighlightBtn) {
    if (story.isHighlight) {
      storyHighlightBtn.style.opacity = '1';
      storyHighlightBtn.style.color = '#ffd700';
    } else {
      storyHighlightBtn.style.opacity = '0.7';
      storyHighlightBtn.style.color = '#fff';
    }
  }
  
  const mediaChanged = !prevStory ||
    prevStory.id !== story.id ||
    prevStory.mediaType !== story.mediaType ||
    prevStory.mediaUrl !== story.mediaUrl;

  const mediaSrc = resolveStoryMediaSrc(story);
  const mediaKey = `${story.id || ''}|${story.mediaType || ''}|${story.mediaUrl || ''}`;
  if (mediaKey !== activeStoryMediaKey) {
    activeStoryMediaKey = mediaKey;
    storyImageRetryCount = 0;
    storyVideoRetryCount = 0;
    if (storyImageRetryTimer) {
      clearTimeout(storyImageRetryTimer);
      storyImageRetryTimer = null;
    }
    if (storyVideoRetryTimer) {
      clearTimeout(storyVideoRetryTimer);
      storyVideoRetryTimer = null;
    }
  }
  
  const { kind: mediaKind, urlExt } = inferStoryMediaKind(story.mediaType, story.mediaUrl);
  
  if (!mediaSrc) {
    storyVideo.pause();
    storyVideo.removeAttribute('src');
    storyVideo.load();
    storyImage.src = '';
    storyVideo.style.display = 'none';
    storyImage.style.display = 'none';
    console.error('Story media is missing or invalid:', JSON.stringify({
      id: story.id,
      url: story.mediaUrl,
      mediaType: story.mediaType,
      urlExt: urlExt
    }));
  } else if (mediaKind === 'video') {
    // Treat as video
    storyImage.src = '';
    storyImage.style.display = 'none';
    storyVideo.style.display = 'block';
    if (mediaChanged) {
      storyVideoSourceCandidates = buildStoryVideoCandidates(story);
      storyVideoSourceIndex = 0;
    }
    const nextSrc = storyVideoSourceCandidates[storyVideoSourceIndex] || mediaSrc;
    if (mediaChanged || storyVideo.src !== nextSrc) {
      storyVideo.src = nextSrc;
      storyVideo.preload = 'metadata';
      forceInlinePlayback(storyVideo, { showControls: true });
      storyVideo.muted = true;
      storyVideo.load();
    }
    storyVideo.play().catch(() => {
      // Safari/iOS may block autoplay; keep controls visible for manual play.
    });
  } else {
    // Treat as image
    storyVideo.pause();
    storyVideo.removeAttribute('src');
    storyVideo.load();
    storyVideo.style.display = 'none';
    storyImage.style.display = 'block';
    if (mediaChanged || storyImage.src !== mediaSrc) {
      storyImage.src = mediaSrc;
    }
  }
  
  if (storyPrevBtn) storyPrevBtn.style.display = storyViewerIndex > 0 ? 'inline-flex' : 'none';
  if (storyNextBtn) storyNextBtn.style.display = storyViewerIndex < storyViewerList.length - 1 ? 'inline-flex' : 'none';
  if (story.id) {
    api(`/api/stories/${story.id}/view`, { method: 'POST' }).catch((err) => {
      console.warn('Failed to mark story view:', err);
    });
  }
}

function renderStoryReactions(story) {
  if (!storyReactions) return;
  storyReactions.innerHTML = '';
  
  const reactions = story.reactions || [];
  if (reactions.length === 0) return;
  
  // Group reactions by emoji
  const grouped = {};
  reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(r);
  });
  
  Object.entries(grouped).forEach(([emoji, users]) => {
    const badge = document.createElement('div');
    badge.className = 'story-reaction-badge';
    badge.innerHTML = `${emoji} <span>${users.length}</span>`;
    storyReactions.appendChild(badge);
  });
}

function openStoryViewer(story, list = null) {
  const normalizedList = (Array.isArray(list) && list.length ? list : [story])
    .map(normalizeStory)
    .filter(Boolean);
  if (!normalizedList.length) {
    console.error('No valid stories to display:', { story, list });
    return;
  }
  const normalizedCurrent = normalizeStory(story) || normalizedList[0];
  storyViewerList = normalizedList;
  const idx = storyViewerList.findIndex((s) => s.id === normalizedCurrent.id);
  hideInstallBanner();
  storyModal.classList.remove('hidden');
  renderStoryAt(idx >= 0 ? idx : 0);
}

storyImage?.addEventListener('error', () => {
  if (!currentStory) return;
  const { kind: mediaKind, urlExt } = inferStoryMediaKind(currentStory.mediaType, currentStory.mediaUrl);
  if (mediaKind !== 'image') return;
  console.error('Story image failed to load:', JSON.stringify({
    url: currentStory.mediaUrl,
    mediaType: currentStory.mediaType,
    urlExt: urlExt,
    timestamp: new Date().toISOString(),
    networkOnline: navigator.onLine
  }));
  
  if (storyImageRetryCount >= STORY_MEDIA_MAX_RETRIES) {
    console.warn('Story image retry limit reached:', currentStory.mediaUrl);
    return;
  }

  // Try to reload a limited number of times if network is online
  if (navigator.onLine) {
    storyImageRetryCount += 1;
    if (storyImageRetryTimer) clearTimeout(storyImageRetryTimer);
    storyImageRetryTimer = setTimeout(() => {
      const src = resolveStoryMediaSrc(currentStory);
      if (!src) return;
      storyImage.src = '';
      storyImage.src = src;
    }, 1000);
  }
});

storyVideo?.addEventListener('error', () => {
  if (!currentStory) return;
  const { kind: mediaKind, urlExt } = inferStoryMediaKind(currentStory.mediaType, currentStory.mediaUrl);
  if (mediaKind !== 'video') return;
  console.error('Story video failed to load:', JSON.stringify({
    url: currentStory.mediaUrl,
    mediaType: currentStory.mediaType,
    urlExt: urlExt,
    timestamp: new Date().toISOString(),
    networkOnline: navigator.onLine
  }));
  
  // Show error message overlay
  showStoryMediaError('Video unavailable - file may have been removed');
  
  if (storyVideoSourceIndex < storyVideoSourceCandidates.length - 1) {
    storyVideoSourceIndex += 1;
    const fallbackSrc = storyVideoSourceCandidates[storyVideoSourceIndex];
    if (fallbackSrc) {
      storyVideo.src = fallbackSrc;
      storyVideo.load();
      storyVideo.play().catch(() => {});
      return;
    }
  }

  if (storyVideoRetryCount >= STORY_MEDIA_MAX_RETRIES) {
    console.warn('Story video retry limit reached:', currentStory.mediaUrl);
    // Auto-advance to next story after max retries
    setTimeout(() => {
      if (storyViewerIndex < storyViewerList.length - 1) {
        renderStoryAt(storyViewerIndex + 1);
      } else {
        closeStory();
      }
    }, 1500);
    return;
  }

  // Try to reload a limited number of times if network is online
  if (navigator.onLine) {
    storyVideoRetryCount += 1;
    if (storyVideoRetryTimer) clearTimeout(storyVideoRetryTimer);
    storyVideoRetryTimer = setTimeout(() => {
      const src = resolveStoryMediaSrc(currentStory);
      if (!src) return;
      storyVideo.src = '';
      storyVideo.src = src;
      storyVideo.load();
    }, 1000);
  }
});

storyVideo?.addEventListener('loadeddata', () => {
  const errorOverlay = document.getElementById('story-error-overlay');
  if (errorOverlay) errorOverlay.style.display = 'none';
});

function showStoryMediaError(message) {
  // Create or update error overlay
  let errorOverlay = document.getElementById('story-error-overlay');
  if (!errorOverlay) {
    errorOverlay = document.createElement('div');
    errorOverlay.id = 'story-error-overlay';
    errorOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      text-align: center;
      z-index: 1000;
      font-size: 14px;
    `;
    const storyViewer = document.getElementById('story-viewer');
    if (storyViewer) {
      storyViewer.appendChild(errorOverlay);
    }
  }
  errorOverlay.textContent = message;
  errorOverlay.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorOverlay) {
      errorOverlay.style.display = 'none';
    }
  }, 5000);
}

function closeStory() {
  storyModal.classList.add('hidden');
  storyVideo.pause();
  storyVideo.src = '';
  if (storyImageRetryTimer) {
    clearTimeout(storyImageRetryTimer);
    storyImageRetryTimer = null;
  }
  if (storyVideoRetryTimer) {
    clearTimeout(storyVideoRetryTimer);
    storyVideoRetryTimer = null;
  }
  storyImageRetryCount = 0;
  storyVideoRetryCount = 0;
  activeStoryMediaKey = '';
  storyViewerList = [];
  storyViewerIndex = 0;
}

closeStoryBtn.addEventListener('click', closeStory);
storyModal.addEventListener('click', (e) => {
  if (e.target === storyModal) closeStory();
});

storyPrevBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (storyViewerIndex > 0) renderStoryAt(storyViewerIndex - 1);
});

storyNextBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (storyViewerIndex < storyViewerList.length - 1) renderStoryAt(storyViewerIndex + 1);
});

// Touch swipe support for story navigation
let touchStartX = 0;
let touchEndX = 0;

storyModal?.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

storyModal?.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  const swipeThreshold = 50;
  if (touchEndX < touchStartX - swipeThreshold) {
    // Swipe left - next story
    if (storyViewerIndex < storyViewerList.length - 1) renderStoryAt(storyViewerIndex + 1);
  }
  if (touchEndX > touchStartX + swipeThreshold) {
    // Swipe right - previous story
    if (storyViewerIndex > 0) renderStoryAt(storyViewerIndex - 1);
  }
}

if (storyUpload) storyUpload.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const uploaded = [];
  const errors = [];
  
  for (const file of files) {
    const formData = new FormData();
    formData.append('media', file);
    formData.append('caption', storyCaption?.value || '');

    try {
      const data = await api('/api/stories', {
        method: 'POST',
        body: formData
      });
      if (data?.story) uploaded.push(data.story);
    } catch (err) {
      console.error('Story upload failed for file:', file.name, err);
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (uploaded.length) {
    // Refresh both sections
    await loadStories();
  }
  if (errors.length > 0) {
    alert(`Upload issues: ${errors.join('\n')}`);
  } else if (uploaded.length > 0) {
    alert('Story uploaded successfully!');
  }
  if (storyCaption) storyCaption.value = '';
  storyUpload.value = '';
});

// Story Reactions
storyReactBtn?.addEventListener('click', () => {
  storyEmojiPicker?.classList.toggle('visible');
});

storyEmojiPicker?.addEventListener('click', async (e) => {
  const emojiBtn = e.target.closest('.emoji-btn');
  if (!emojiBtn || !currentStory) return;
  
  const emoji = emojiBtn.dataset.emoji;
  try {
    await api(`/api/stories/${currentStory.id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji })
    });
    
    // Update local story with new reaction
    if (!currentStory.reactions) currentStory.reactions = [];
    currentStory.reactions = currentStory.reactions.filter(r => r.userId !== me?.id);
    currentStory.reactions.push({
      userId: me?.id,
      username: me?.username,
      emoji
    });
    renderStoryReactions(currentStory);
    storyEmojiPicker?.classList.remove('visible');
  } catch (err) {
    console.error('Failed to add reaction:', err);
  }
});

// Story Replies
storyReplySend?.addEventListener('click', async () => {
  if (!currentStory || !storyReplyInput) return;
  
  const text = storyReplyInput.value.trim();
  if (!text) return;
  
  try {
    await api(`/api/stories/${currentStory.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    storyReplyInput.value = '';
    alert('Reply sent!');
  } catch (err) {
    console.error('Failed to send reply:', err);
  }
});

storyReplyInput?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    storyReplySend?.click();
  }
});

// Story Highlight
storyHighlightBtn?.addEventListener('click', async () => {
  if (!currentStory) return;
  
  const title = currentStory.isHighlight ? '' : prompt('Enter highlight name:', currentStory.caption || 'My Story');
  if (title === null) return;
  
  try {
    await api(`/api/stories/${currentStory.id}/highlight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    
    currentStory.isHighlight = !currentStory.isHighlight;
    if (currentStory.highlightTitle !== undefined) {
      currentStory.highlightTitle = title;
    }
    renderStoryAt(storyViewerIndex);
  } catch (err) {
    console.error('Failed to toggle highlight:', err);
  }
});

// Story Viewers
storyViewersBtn?.addEventListener('click', async () => {
  if (!currentStory) return;
  
  try {
    const data = await api(`/api/stories/${currentStory.id}/viewers`);
    if (data.viewers && data.viewers.length > 0) {
      const names = data.viewers.map(v => v.username || v.displayName).join(', ');
      alert(`Viewed by: ${names}`);
    } else {
      alert('No viewers yet');
    }
  } catch (err) {
    console.error('Failed to get viewers:', err);
  }
});

function tempId() {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function markPendingFailed(clientTempId) {
  const idx = allMessages.findIndex((m) => m.clientTempId === clientTempId);
  if (idx >= 0) {
    allMessages[idx].sendState = 'failed';
    renderAllLoadedMessages(false);
  }
  const qIdx = pendingMessageQueue.findIndex((m) => m.clientTempId === clientTempId);
  if (qIdx >= 0) {
    pendingMessageQueue[qIdx].state = 'failed';
    persistQueue();
  }
}

function enqueuePending(payload, clientTempId) {
  pendingMessageQueue.push({
    clientTempId,
    payload,
    createdAt: new Date().toISOString(),
    state: 'queued'
  });
  persistQueue();
}

function removePending(clientTempId) {
  pendingMessageQueue = pendingMessageQueue.filter((m) => m.clientTempId !== clientTempId);
  persistQueue();
  const timer = pendingMessageTimers.get(clientTempId);
  if (timer) clearTimeout(timer);
  pendingMessageTimers.delete(clientTempId);
}

function queueLocalMessage(payload, clientTempId) {
  const localMsg = {
    id: clientTempId,
    clientTempId,
    fromUserId: me?.id,
    toUserId: payload.toUserId,
    text: payload.text || '',
    mediaType: payload.mediaType,
    mediaUrl: payload.mediaUrl,
    duration: payload.duration,
    replyTo: payload.replyTo || null,
    createdAt: new Date().toISOString(),
    readBy: [],
    deliveredAt: null,
    sendState: 'sending'
  };
  allMessages.push(localMsg);
  renderAllLoadedMessages(true);
  updateChatSummary(payload.toUserId, localMsg, false);
  loadChats();
}

function emitOrQueueMessage(payload, clientTempId) {
  enqueuePending(payload, clientTempId);
  const event = payload.mediaType ? 'media_message' : 'private_message';

  if (socket && socket.connected) {
    socket.emit(event, { ...payload, clientTempId });
    const timer = setTimeout(() => {
      markPendingFailed(clientTempId);
    }, 8000);
    pendingMessageTimers.set(clientTempId, timer);
    return;
  }

  showQueuedMessageNotice();
  reconnectSocketIfNeeded();
}

function flushPendingQueue() {
  if (isNetworkOffline()) return;
  if (!socket || !socket.connected) return;
  pendingMessageQueue.forEach((item) => {
    if (item.state === 'sent') return;
    const event = item.payload.mediaType ? 'media_message' : 'private_message';
    socket.emit(event, { ...item.payload, clientTempId: item.clientTempId });
    item.state = 'sent';
    const timer = setTimeout(() => markPendingFailed(item.clientTempId), 8000);
    pendingMessageTimers.set(item.clientTempId, timer);
  });
  persistQueue();
}

function reconcileServerMessage(message) {
  if (!message.clientTempId) return false;
  const idx = allMessages.findIndex((m) => m.clientTempId === message.clientTempId);
  if (idx < 0) return false;
  allMessages[idx] = {
    ...message,
    sendState: null
  };
  removePending(message.clientTempId);
  return true;
}

function resendPendingMessage(clientTempId) {
  const queued = pendingMessageQueue.find((m) => m.clientTempId === clientTempId);
  if (!queued) return;
  const idx = allMessages.findIndex((m) => m.clientTempId === clientTempId);
  if (idx >= 0) {
    allMessages[idx].sendState = 'sending';
  }
  renderAllLoadedMessages(false);
  if (socket && socket.connected) {
    const event = queued.payload.mediaType ? 'media_message' : 'private_message';
    socket.emit(event, { ...queued.payload, clientTempId });
    queued.state = 'sent';
    persistQueue();
    const timer = setTimeout(() => markPendingFailed(clientTempId), 8000);
    pendingMessageTimers.set(clientTempId, timer);
  }
}

// Socket Setup
function setupSocket() {
  if (!token) return;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = io(window.location.origin, {
    path: '/socket.io',
    auth: { token },
    transports: ['polling', 'websocket'],
    upgrade: true,
    rememberUpgrade: false,
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    withCredentials: true
  });

  socket.on('connect', () => {
    flushPendingQueue();
    groups.forEach((g) => socket.emit('group:join', { groupId: g._id || g.id }));
    if (currentPeer) {
      chatStatus.textContent = onlineUsers.has(currentPeer.id) ? 'Online' : 'Last seen recently';
      chatStatus.style.color = onlineUsers.has(currentPeer.id) ? '#00a884' : '#667781';
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err);
    authStatus.textContent = err.message || 'Connection failed';
    if (currentPeer) {
      chatStatus.textContent = 'Connection error';
      chatStatus.style.color = '#f15c6d';
    }
    if ((err.message || '').toLowerCase().includes('token')) {
      clearSession();
      renderAuth();
    }
  });

  socket.on('disconnect', () => {
    if (currentPeer) {
      chatStatus.textContent = 'Disconnected';
      chatStatus.style.color = '#f15c6d';
    }
    if (isNetworkOffline()) {
      showInAppBanner('Offline mode: messages will be queued.');
    }
  });

  socket.on('online_users', (list) => {
    onlineUsers = new Set(list);
    refreshUsers();
    loadChats();
    
    if (currentPeer) {
      chatStatus.textContent = onlineUsers.has(currentPeer.id) ? 'Online' : 'Last seen recently';
      chatStatus.style.color = onlineUsers.has(currentPeer.id) ? '#00a884' : '#667781';
    }
  });

  socket.on('message', (message) => {
    const fromMe = message.fromUserId === me?.id;
    const peerId = fromMe ? message.toUserId : message.fromUserId;
    const isActiveDirect = !currentGroup && currentPeer && currentPeer.id === peerId;

    if (fromMe && isActiveDirect) {
      const matched = reconcileServerMessage(message);
      if (!matched) allMessages.push(message);
    } else if (!fromMe && !blockedUsers.has(peerId) && isActiveDirect) {
      allMessages.push(message);
    } else if (fromMe) {
      reconcileServerMessage(message);
    }

    updateChatSummary(peerId, message, !fromMe);
    loadChats();

    if (isActiveDirect && !blockedUsers.has(peerId)) {
      renderAllLoadedMessages(true);
      if (!fromMe) markMessagesAsRead(currentPeer.id);
    }

    if (!fromMe) {
      notifyIncomingMessage(message);
    }
  });

  socket.on('group:message', (message) => {
    const groupId = message.groupId;
    if (!groupId) return;
    if (currentGroup && (currentGroup._id || currentGroup.id) === groupId) {
      allMessages.push({
        ...message,
        toUserId: groupId
      });
      renderAllLoadedMessages(true);
    }
    const g = groups.find((x) => (x._id || x.id) === groupId);
    if (g) {
      g.lastMessage = { text: messagePreview(message), createdAt: message.createdAt };
      renderGroups();
    }
  });

  socket.on('message_updated', (message) => {
    const idx = allMessages.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      allMessages[idx] = { ...allMessages[idx], ...message };
      renderAllLoadedMessages(false);
    }
  });

  socket.on('user_typing', ({ userId, username, isTyping }) => {
    if (currentPeer && currentPeer.id === userId) {
      const typingIndicator = document.getElementById('typingIndicator');
      const typingText = document.getElementById('typingText');
      
      if (lastTypingResetTimeout) clearTimeout(lastTypingResetTimeout);
      
      if (isTyping) {
        typingText.textContent = `${username || 'User'} is typing...`;
        typingIndicator.classList.remove('hidden');
        lastTypingResetTimeout = setTimeout(() => {
          typingIndicator.classList.add('hidden');
        }, 3000);
      } else {
        typingIndicator.classList.add('hidden');
      }
    }
  });

  socket.on('messages_delivered', ({ messageIds, deliveredAt }) => {
    const deliveredSet = new Set(messageIds || []);
    allMessages = allMessages.map((m) => {
      if (deliveredSet.has(m.id)) {
        return { ...m, deliveredAt: deliveredAt || new Date().toISOString() };
      }
      return m;
    });
    renderAllLoadedMessages(false);
  });

  socket.on('messages_read', ({ by, messageIds }) => {
    const readSet = new Set(messageIds || []);
    allMessages = allMessages.map((m) => {
      if (readSet.has(m.id)) {
        const readBy = Array.isArray(m.readBy) ? m.readBy : [];
        if (!readBy.includes(by)) readBy.push(by);
        return { ...m, readBy };
      }
      return m;
    });
    renderAllLoadedMessages(false);
  });

  socket.on('new_story', (story) => {
    // Only add if it's not our own story (we handle our stories separately)
    if (story.userId !== me?.id) {
      stories.unshift(story);
      renderStories();
    }
  });

  socket.on('story_reaction', ({ storyId, reaction }) => {
    // Update story if we're viewing it
    if (currentStory && currentStory.id === storyId) {
      if (!currentStory.reactions) currentStory.reactions = [];
      const existing = currentStory.reactions.findIndex(r => r.userId === reaction.userId);
      if (existing >= 0) {
        currentStory.reactions[existing] = reaction;
      } else {
        currentStory.reactions.push(reaction);
      }
      renderStoryReactions(currentStory);
    }
  });

  socket.on('story_reply', ({ storyId, reply }) => {
    // Notify user about reply
    alert(`${reply.fromUsername} replied to your story: "${reply.text}"`);
  });

  socket.on('story_viewed', ({ storyId, viewerId, viewedCount }) => {
    // Update view count if we're viewing this story
    if (currentStory && currentStory.id === storyId) {
      currentStory.viewsCount = viewedCount;
      if (storyViewCount) {
        storyViewCount.textContent = viewedCount;
      }
    }
  });





  socket.on('post_liked', ({ postId, likesCount, isLiked }) => {
    const idx = posts.findIndex((p) => p._id === postId);
    if (idx === -1) return;
    posts[idx].likesCount = likesCount;
    if (typeof isLiked === 'boolean') posts[idx].isLiked = isLiked;
    if (activeTab === 'posts') renderPosts();
  });

  socket.on('post_comment', ({ postId, commentsCount }) => {
    const idx = posts.findIndex((p) => p._id === postId);
    if (idx === -1) return;
    posts[idx].commentsCount = commentsCount;
    if (activeTab === 'posts') renderPosts();
  });

  socket.on('call_offer', async ({ fromUserId, fromUsername, offer, callType }) => {
    if (peerConnection || pendingIncomingCall) {
      socket.emit('call_end', { toUserId: fromUserId });
      return;
    }
    currentCallPeer = { id: fromUserId, username: fromUsername };
    currentCallType = callType === 'video' ? 'video' : 'voice';
    callStartTime = 0; // Will be set when call is accepted
    pendingIncomingCall = { fromUserId, fromUsername, offer, callType: currentCallType };
    appSection.classList.add('active-chat');
    noChatSelected?.classList.add('hidden');
    activeChat?.classList.remove('hidden');
    callUsername.textContent = `@${fromUsername}`;
    callAvatar.textContent = fromUsername.charAt(0).toUpperCase();
    callStatus.textContent = `Incoming ${currentCallType} call...`;
    showInAppBanner(`Incoming ${currentCallType} call from @${fromUsername}`, 'call');
    startIncomingRingtone();
    if (notificationSettings.vibrate && navigator.vibrate) {
      navigator.vibrate([250, 120, 250, 120, 250]);
    }
    incomingCallActions?.classList.remove('hidden');
    callModal.classList.remove('hidden');
  });

  socket.on('call_answer', async ({ answer }) => {
    if (peerConnection) {
      try {
        if (peerConnection.signalingState === 'have-local-offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          await flushPendingIceCandidates();
        }
        callStatus.textContent = 'Connecting...';
      } catch (err) {
        console.error('Failed to apply call answer:', err);
      }
    }
  });

  socket.on('ice_candidate', async ({ candidate }) => {
    if (peerConnection && candidate) {
      try {
        const rtcCandidate = new RTCIceCandidate(candidate);
        if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
          await peerConnection.addIceCandidate(rtcCandidate);
        } else {
          pendingIceCandidates.push(rtcCandidate);
        }
      } catch (_e) {
        // Ignore malformed candidates.
      }
    }
  });

  socket.on('call_end', () => {
    stopIncomingRingtone();
    const duration = callStartTime > 0 ? Math.round((Date.now() - callStartTime) / 1000) : 0;
    const status = callStartTime > 0 ? 'answered' : 'missed';
    endCall(true, status, duration);
    callModal.classList.add('hidden');
  });
}























// ============================================
// Posts / Timeline
// ============================================
async function loadPosts() {
  try {
    const data = await api('/api/posts/timeline');
    posts = data.posts || [];
    renderPosts();
    createPostButton();
  } catch (err) {
    console.error('Failed to load posts:', err);
    posts = [];
    renderPosts();
    if (postsFeed) {
      postsFeed.innerHTML = `<div class="list-empty">Failed to load posts: ${escapeHtml(err.message || 'unknown error')}</div>`;
    }
  }
}

function renderPosts() {
  if (!postsFeed) return;
  
  postsFeed.innerHTML = '';
  
  if (posts.length === 0) {
    postsFeed.innerHTML = '<div class="list-empty">No posts yet. Create the first post!</div>';
    return;
  }
  
  posts.forEach(post => {
    const postEl = createPostElement(post);
    postsFeed.appendChild(postEl);
  });
}

function createPostElement(post) {
  const div = document.createElement('div');
  div.className = 'post-card';
  div.style.cssText = 'background:#fff;border-radius:8px;margin:8px 0;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;';
  header.innerHTML = `
    <div class="avatar" style="width:36px;height:36px;border-radius:50%;background:var(--whatsapp-green);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;">${(post.username || 'U').charAt(0).toUpperCase()}</div>
    <div style="flex:1;">
      <div style="font-weight:600;font-size:14px;">@${escapeHtml(post.username || 'user')}</div>
      ${post.location?.name ? `<div style="font-size:12px;color:#666;">📍 ${escapeHtml(post.location.name)}</div>` : ''}
    </div>
  `;
  
  // Media (carousel)
  const mediaContainer = document.createElement('div');
  if (post.media && post.media.length > 0) {
    if (post.media.length === 1) {
      const media = post.media[0];
      if (media.type === 'video') {
        const video = document.createElement('video');
        video.src = resolveMediaSrc(media.url);
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.crossOrigin = 'anonymous';
        video.style.cssText = 'width:100%;max-height:400px;border-radius:8px;';
        mediaContainer.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = media.url;
        img.style.cssText = 'width:100%;max-height:400px;object-fit:cover;border-radius:8px;';
        mediaContainer.appendChild(img);
      }
    } else {
      const carousel = document.createElement('div');
      carousel.style.cssText = 'display:flex;overflow-x:auto;gap:4px;scroll-snap-type:x mandatory;';
      post.media.forEach((m) => {
        if (m.type === 'video') {
          const video = document.createElement('video');
          video.src = resolveMediaSrc(m.url);
          video.controls = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.crossOrigin = 'anonymous';
          video.style.cssText = 'width:200px;height:250px;object-fit:cover;border-radius:4px;scroll-snap-align:start';
          carousel.appendChild(video);
        } else {
          const img = document.createElement('img');
          img.src = m.url;
          img.style.cssText = 'width:200px;height:250px;object-fit:cover;border-radius:4px;scroll-snap-align:start;';
          carousel.appendChild(img);
        }
      });
      mediaContainer.appendChild(carousel);
    }
  }
  
  // Actions
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:16px;margin:10px 0;';
  actions.innerHTML = `
    <button class="post-action like-btn" data-id="${post._id}" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;">
      <span>${post.isLiked ? '❤️' : '🤍'}</span> <span>${post.likesCount || 0}</span>
    </button>
    <button class="post-action comment-btn" data-id="${post._id}" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;">
      <span>💬</span> <span>${post.commentsCount || 0}</span>
    </button>
    <button class="post-action save-btn" data-id="${post._id}" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;">
      <span>${post.isSaved ? '🔖' : '🏷️'}</span>
    </button>
    <button class="post-action share-btn" data-id="${post._id}" style="background:none;border:none;cursor:pointer;">
      <span>📤</span>
    </button>
  `;
  
  // Caption
  const captionEl = document.createElement('p');
  captionEl.style.cssText = 'margin:8px 0;font-size:14px;';
  if (post.caption) {
    const escapedCaption = escapeHtml(post.caption);
    captionEl.innerHTML = escapedCaption.replace(/#(\w+)/g, '<span style="color:#3897f0;">#$1</span>');
  }
  
  div.appendChild(header);
  if (mediaContainer.childNodes.length) div.appendChild(mediaContainer);
  div.appendChild(actions);
  if (post.caption) div.appendChild(captionEl);
  
  // Event listeners
  actions.querySelector('.like-btn').onclick = () => togglePostLike(post._id);
  actions.querySelector('.comment-btn').onclick = () => openPostComments(post._id);
  actions.querySelector('.save-btn').onclick = () => togglePostSave(post._id);
  actions.querySelector('.share-btn').onclick = () => sharePost(post._id);
  
  return div;
}

async function togglePostLike(postId) {
  try {
    const data = await api(`/api/posts/${postId}/like`, 'POST');
    if (data.post) {
      const idx = posts.findIndex(p => p._id === postId);
      if (idx !== -1) {
        posts[idx].isLiked = data.post.isLiked;
        posts[idx].likesCount = data.post.likesCount;
        renderPosts();
      }
    }
  } catch (err) {
    console.error('Failed to like post:', err);
  }
}

async function togglePostSave(postId) {
  try {
    const data = await api(`/api/posts/${postId}/save`, 'POST');
    if (data.post) {
      const idx = posts.findIndex(p => p._id === postId);
      if (idx !== -1) {
        posts[idx].isSaved = data.post.isSaved;
        renderPosts();
      }
    }
  } catch (err) {
    console.error('Failed to save post:', err);
  }
}

async function sharePost(postId) {
  try {
    await api(`/api/posts/${postId}/share-to-story`, 'POST');
    alert('Post shared to your story!');
  } catch (err) {
    console.error('Failed to share post:', err);
    alert('Failed to share post');
  }
}

async function openPostComments(postId) {
  try {
    const data = await api(`/api/posts/${postId}/comments`);
    const comments = data.comments || [];
    const preview = comments
      .slice(0, 8)
      .map((c) => `${c.username}: ${c.text}`)
      .join('\n');
    const promptText = `${preview || 'No comments yet.'}\n\nWrite a comment (leave empty to cancel):`;
    const text = prompt(promptText, '');
    if (text === null || !text.trim()) return;

    const result = await api(`/api/posts/${postId}/comments`, 'POST', { text: text.trim() });
    if (result.comment) {
      const idx = posts.findIndex((p) => p._id === postId);
      if (idx !== -1) {
        posts[idx].commentsCount = (posts[idx].commentsCount || 0) + 1;
        renderPosts();
      }
    }
  } catch (err) {
    console.error('Failed to load/add post comments:', err);
    alert(`Comments error: ${err.message}`);
  }
}

// Post upload
let postFileInput = null;

function createPostButton() {
  const createPostBtn = el('createPostBtn');
  if (!createPostBtn || createPostBtn.dataset.setup) return;
  
  createPostBtn.dataset.setup = 'true';
  
  // Create hidden file input
  postFileInput = document.createElement('input');
  postFileInput.type = 'file';
  postFileInput.accept = 'image/*,video/*';
  postFileInput.multiple = true;
  postFileInput.setAttribute('capture', 'environment'); // Allow camera access on mobile
  postFileInput.style.display = 'none';
  postFileInput.onchange = handlePostUpload;
  
  // Add error handler for debugging
  postFileInput.onerror = (err) => {
    console.error('File input error:', err);
    alert('Error selecting file. Please try again.');
  };
  
  document.body.appendChild(postFileInput);
  
  createPostBtn.onclick = () => postFileInput.click();
}

async function handlePostUpload(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  // Use a modal/prompt alternative that works on mobile
  const caption = await showMobilePrompt('Enter a caption for your post (optional):');
  const location = await showMobilePrompt('Enter location (optional):');
  
  const formData = new FormData();
  files.forEach(f => formData.append('media', f));
  if (caption) formData.append('caption', caption);
  if (location) formData.append('location', JSON.stringify({ name: location }));
  
  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Upload failed');
    }
    
    alert('Post created successfully!');
    loadPosts();
  } catch (err) {
    console.error('Failed to create post:', err);
    alert('Failed to create post: ' + err.message);
  }
  
  e.target.value = '';
}

// Mobile-friendly prompt alternative
function showMobilePrompt(message) {
  return new Promise((resolve) => {
    // Try native prompt first (works on some mobile browsers)
    const result = prompt(message);
    if (result !== null) {
      resolve(result);
      return;
    }
    // If prompt returns null (cancelled or not supported), resolve with empty string
    resolve('');
  });
}

// WebRTC
async function getUserMediaSafe(constraints) {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacyGetUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;

  if (legacyGetUserMedia) {
    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject);
    });
  }

  const secureHint = window.isSecureContext
    ? ''
    : ' Open the app on HTTPS (or http://localhost) and try again.';
  throw new Error(`Media devices API is unavailable in this browser/context.${secureHint}`);
}

async function flushPendingIceCandidates() {
  if (!peerConnection || !pendingIceCandidates.length) return;
  const candidates = pendingIceCandidates.splice(0, pendingIceCandidates.length);
  for (const candidate of candidates) {
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (_err) {
      // Ignore invalid/stale candidates from race conditions.
    }
  }
}

async function startCall(peerId, withVideo, offer) {
  pendingIceCandidates = [];
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  localStream = await getUserMediaSafe({ audio: true, video: withVideo });
  localVideo.srcObject = localStream;
  localVideo.muted = true;
  localVideo.play().catch(() => {});
  
  peerConnection = new RTCPeerConnection({
    ...rtcConfig,
    iceCandidatePoolSize: 8
  });
  peerConnection.ontrack = (evt) => {
    remoteVideo.srcObject = evt.streams[0];
    remoteVideo.play().catch(() => {});
  };
  peerConnection.onicecandidate = (evt) => {
    if (evt.candidate) {
      socket.emit('ice_candidate', { toUserId: peerId, candidate: evt.candidate });
    }
  };
  peerConnection.onconnectionstatechange = () => {
    if (!peerConnection) return;
    const state = peerConnection.connectionState;
    if (state === 'connected') {
      if (!callStartTime) callStartTime = Date.now();
      callStatus.textContent = 'Call connected';
      return;
    }
    if (state === 'connecting') {
      callStatus.textContent = 'Connecting...';
      return;
    }
    if (state === 'failed') {
      const duration = callStartTime > 0 ? Math.round((Date.now() - callStartTime) / 1000) : 0;
      endCall(false, callStartTime > 0 ? 'answered' : 'missed', duration);
      callModal.classList.add('hidden');
      alert('Call connection failed. Check network or TURN server settings.');
    }
  };

  for (const track of localStream.getTracks()) {
    peerConnection.addTrack(track, localStream);
  }

  if (offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await flushPendingIceCandidates();
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('call_answer', { toUserId: peerId, answer });
    callStatus.textContent = 'Connecting...';
  } else {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call_offer', { toUserId: peerId, offer, callType: withVideo ? 'video' : 'voice' });
    callStatus.textContent = 'Calling...';
  }
}

function endCall(fromRemote = false, status = 'missed', duration = 0) {
  stopIncomingRingtone();
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  // Log the call
  if (currentCallPeer && !fromRemote) {
    logCall(currentCallPeer.id, currentCallPeer.username, currentCallType, status, duration).catch(() => {});
    
    // Add call notification to chat
    addCallNotification(currentCallPeer.id, currentCallPeer.username, currentCallType, status, duration);
  } else if (fromRemote && currentCallPeer) {
    // Incoming call ended - still log it
    logCall(currentCallPeer.id, currentCallPeer.username, currentCallType, status, duration).catch(() => {});
    
    // Add call notification for incoming call
    addCallNotification(currentCallPeer.id, currentCallPeer.username, currentCallType, status, duration);
  }
  
  if (socket && currentCallPeer) {
    if (!fromRemote) socket.emit('call_end', { toUserId: currentCallPeer.id });
  }
  callStartTime = 0;
  pendingIncomingCall = null;
  incomingCallActions?.classList.add('hidden');
  pendingIceCandidates = [];
  currentCallPeer = null;
}


// Add call notification to chat
function addCallNotification(peerId, peerUsername, callType, callStatus, duration) {
  const callMessage = {
    id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fromUserId: peerId === me?.id ? me.id : peerId,
    fromUsername: peerId === me?.id ? me.username : peerUsername,
    toUserId: peerId === me?.id ? peerId : me.id,
    text: '',
    mediaType: null,
    mediaUrl: null,
    createdAt: new Date().toISOString(),
    isCallNotification: true,
    callInfo: {
      type: callType,
      status: callStatus,
      duration: formatDuration(duration)
    },
    deliveredAt: new Date().toISOString(),
    readBy: []
  };
  
  // Add to local messages
  const peerIdStr = peerId === me?.id ? peerId : peerId;
  
  // Check if we have messages for this peer
  const existingMessages = allMessages.filter(m => 
    (m.toUserId === peerIdStr || m.fromUserId === peerIdStr) &&
    !m.groupId
  );
  
  if (existingMessages.length > 0 || currentPeer?.id === peerIdStr) {
    addMessage(callMessage);
  }
  
  // Update chat list preview
  const previewText = callStatus === 'missed' 
    ? `Missed ${callType} call` 
    : `${callType === 'video' ? '📹' : '📞'} ${callType} call (${formatDuration(duration)})`;
  updateChatListPreview(peerIdStr, previewText);
}

function updateChatListPreview(peerId, previewText) {
  const chatItem = document.querySelector(`[data-peer-id="${peerId}"]`);
  if (chatItem) {
    const preview = chatItem.querySelector('.list-item-preview');
    if (preview) {
      preview.textContent = previewText;
    }
  }
}

// Call logging
let callLogs = [];
let callFilter = 'all';

async function logCall(peerId, peerUsername, type, status, duration = 0) {
  try {
    await api('/api/calls/log', {
      method: 'POST',
      body: JSON.stringify({
        peerId,
        peerUsername,
        type,
        status,
        duration
      })
    });
  } catch (err) {
    console.error('Failed to log call:', err);
  }
}

async function loadCallLogs(filter = 'all') {
  callFilter = filter;
  const callsList = document.getElementById('callsList');
  callsList.innerHTML = '<li class="list-empty">Loading...</li>';
  
  try {
    const url = filter === 'all' ? '/api/calls' : `/api/calls?type=${filter}`;
    const data = await api(url);
    callLogs = data.calls || [];
    renderCallLogs();
  } catch (err) {
    console.error('Failed to load call logs:', err);
    callsList.innerHTML = '<li class="list-empty">Failed to load calls</li>';
  }
}

function renderCallLogs() {
  const callsList = document.getElementById('callsList');
  
  if (callLogs.length === 0) {
    callsList.innerHTML = '<li class="list-empty">No call history</li>';
    return;
  }
  
  callsList.innerHTML = '';
  
  for (const call of callLogs) {
    const li = document.createElement('li');
    li.className = 'call-log-item';
    
    const statusIcon = call.status === 'missed' 
      ? '<svg class="call-log-icon missed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 16.92A16.16 16.16 0 0 0 12.36 15a16.17 16.17 0 0 0-10.64 1.92"/><path d="M1.08 7.08A16.17 16.17 0 0 1 12.36 1a16.16 16.16 0 0 1 10.64 7.08"/></svg>'
      : '<svg class="call-log-icon answered" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 16.92A16.16 16.16 0 0 0 12.36 15a16.17 16.17 0 0 0-10.64 1.92"/><path d="M1.08 7.08A16.17 16.17 0 0 1 12.36 1a16.16 16.16 0 0 1 10.64 7.08"/></svg>';
    
    const directionIcon = call.isOutgoing 
      ? '<svg class="call-log-icon outgoing" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>'
      : '<svg class="call-log-icon incoming" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>';
    
    const typeIcon = call.type === 'video' 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81"/></svg>';
    
    const timeStr = formatTimeAgo(new Date(call.startedAt));
    const durationStr = call.duration > 0 ? formatDuration(call.duration) : '';
    
    li.innerHTML = `
      <div class="call-log-avatar">${call.peerUsername.charAt(0).toUpperCase()}</div>
      <div class="call-log-info">
        <div class="call-log-name">${escapeHtml(call.peerUsername)} ${directionIcon}</div>
        <div class="call-log-details">
          ${statusIcon} ${typeIcon} ${durationStr || call.status}
        </div>
      </div>
      <div class="call-log-time">${timeStr}</div>
    `;
    
    li.addEventListener('click', () => {
      // Start chat with this user
      selectPeer({ id: call.peerId, username: call.peerUsername, displayName: call.peerUsername });
      switchToTab('chats');
    });
    
    callsList.appendChild(li);
  }
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Call filter buttons
document.querySelectorAll('.call-filters .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.call-filters .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadCallLogs(btn.dataset.filter);
  });
});

// Event Listeners
async function pickProfileImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files.length ? input.files[0] : null;
      input.remove();
      resolve(file);
    }, { once: true });
    input.click();
  });
}

async function uploadProfileImage(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const data = await api('/api/me/avatar', {
    method: 'POST',
    body: formData
  });
  return data?.user?.avatarUrl || '';
}

editProfileBtn?.addEventListener('click', async () => {
  const currentDisplay = me?.displayName || me?.username || '';
  const currentDescription = me?.description || '';

  const displayName = prompt('Display name:', currentDisplay);
  if (displayName === null) return;
  const description = prompt('Description:', currentDescription);
  if (description === null) return;

  try {
    let avatarUrl = me?.avatarUrl || '';
    const wantsNewPhoto = confirm('Upload a new profile picture? Click OK to choose an image.');
    if (wantsNewPhoto) {
      const file = await pickProfileImageFile();
      if (file) {
        avatarUrl = await uploadProfileImage(file);
      }
    }

    const data = await api('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: displayName.trim(),
        description: description.trim(),
        avatarUrl: avatarUrl.trim()
      })
    });
    if (data?.user) {
      me = data.user;
      localStorage.setItem('me', JSON.stringify(me));
      showApp();
      await refreshUsers();
      await loadChats();
      if (currentPeer && currentPeer.id === me.id) {
        currentPeer = { ...currentPeer, ...me };
      }
    }
  } catch (err) {
    alert(`Failed to update profile: ${err.message}`);
  }
});

userSearch?.addEventListener('input', (event) => {
  userSearchTerm = event.target?.value || '';
  renderUsers();
});

chatMenuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  chatSettingsMenu?.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#chatMenuBtn') && !e.target.closest('#chatSettingsMenu')) {
    chatSettingsMenu?.classList.add('hidden');
  }
});

createGroupBtn?.addEventListener('click', async () => {
  // Populate user select list
  const userSelectList = document.getElementById('userSelectList');
  userSelectList.innerHTML = '';
  
  const selectedUserIds = new Set();
  
  users.forEach(user => {
    const item = document.createElement('div');
    item.className = 'user-select-item';
    item.innerHTML = `
      <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
      <div>
        <div class="user-name">${user.displayName || user.username}</div>
        <div class="user-username">@${user.username}</div>
      </div>
    `;
    item.onclick = () => {
      if (selectedUserIds.has(user.id)) {
        selectedUserIds.delete(user.id);
        item.classList.remove('selected');
      } else {
        selectedUserIds.add(user.id);
        item.classList.add('selected');
      }
    };
    userSelectList.appendChild(item);
  });
  
  // Show modal
  document.getElementById('groupNameInput').value = '';
  document.getElementById('createGroupModal').classList.remove('hidden');
});

document.getElementById('closeCreateGroupBtn')?.addEventListener('click', () => {
  document.getElementById('createGroupModal').classList.add('hidden');
});

document.getElementById('cancelCreateGroupBtn')?.addEventListener('click', () => {
  document.getElementById('createGroupModal').classList.add('hidden');
});

document.getElementById('confirmCreateGroupBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('groupNameInput').value.trim();
  if (!name) {
    alert('Please enter a group name');
    return;
  }
  
  const memberIds = Array.from(selectedUserIds);
  if (memberIds.length === 0) {
    alert('Please select at least one member');
    return;
  }
  
  try {
    await api('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, memberIds })
    });
    await loadGroups();
    document.getElementById('createGroupModal').classList.add('hidden');
  } catch (err) {
    alert(`Failed to create group: ${err.message}`);
  }
});

// Close modal when clicking outside
document.getElementById('createGroupModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'createGroupModal') {
    document.getElementById('createGroupModal').classList.add('hidden');
  }
});

let selectedUserIds = new Set();

notifToggle?.addEventListener('change', async () => {
  notificationSettings.enabled = Boolean(notifToggle.checked);
  if (notificationSettings.enabled && 'Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (_) {}
  }
  persistNotificationSettings();
});

soundToggle?.addEventListener('change', () => {
  notificationSettings.sound = Boolean(soundToggle.checked);
  if (!notificationSettings.sound) {
    stopIncomingRingtone();
  }
  persistNotificationSettings();
});

vibrateToggle?.addEventListener('change', () => {
  notificationSettings.vibrate = Boolean(vibrateToggle.checked);
  persistNotificationSettings();
});

muteChatBtn?.addEventListener('click', async () => {
  if (!currentPeer) return;
  if (mutedUsers.has(currentPeer.id)) mutedUsers.delete(currentPeer.id);
  else mutedUsers.add(currentPeer.id);
  persistCollections();
  updateChatControlLabels();
  await loadChats();
});

archiveChatBtn?.addEventListener('click', async () => {
  if (!currentPeer) return;
  if (archivedUsers.has(currentPeer.id)) archivedUsers.delete(currentPeer.id);
  else archivedUsers.add(currentPeer.id);
  persistCollections();
  updateChatControlLabels();
  await loadChats();
});

pinChatBtn?.addEventListener('click', async () => {
  if (!currentPeer) return;
  if (pinnedChats.has(currentPeer.id)) pinnedChats.delete(currentPeer.id);
  else pinnedChats.add(currentPeer.id);
  persistCollections();
  updateChatControlLabels();
  await loadChats();
});

blockUserBtn?.addEventListener('click', async () => {
  if (!currentPeer) return;
  if (blockedUsers.has(currentPeer.id)) blockedUsers.delete(currentPeer.id);
  else blockedUsers.add(currentPeer.id);
  persistCollections();
  updateChatControlLabels();
  await loadChats();
});

let authIntent = 'login';

authForm.querySelectorAll('button[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    authIntent = btn.dataset.action || 'login';
  });
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const activeAction = document.activeElement?.dataset?.action;
  const action = e.submitter?.dataset?.action || activeAction || authIntent || 'login';
  const username = el('username').value.trim();
  const password = el('password').value;

  try {
    authStatus.textContent = '';
    const finishSignIn = async (authData) => {
      if (!authData?.token || !authData?.user) {
        throw new Error('Invalid auth response from server');
      }
      saveSession(authData.token, authData.user);
      await loadMeProfile();
      await fetchIceConfig(); // Fetch TURN servers from server
      renderAuth();
      showApp();
      setupSocket();
      await refreshUsers();
      await loadChats();
      await loadGroups();
      await loadStories();
    };

    const endpoint = action === 'register' ? '/api/auth/register' : '/api/auth/login';
    const data = await api(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (data?.requires2FA) {
      const code = window.prompt('Enter your 2FA code');
      if (!code || !code.trim()) {
        authStatus.textContent = '2FA code is required to continue';
        return;
      }
      const verified = await api('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: data.tempToken, code: code.trim() })
      });
      await finishSignIn(verified);
      return;
    }

    await finishSignIn(data);
  } catch (err) {
    const msg = err.message || 'Authentication failed';
    if (msg.toLowerCase().includes('invalid credentials')) {
      authStatus.textContent = 'Invalid username/password. If you are new, click Create Account.';
      return;
    }
    authStatus.textContent = msg;
  }
});

messageInput.addEventListener('input', () => {
  startTyping();
  // Show send button when there's text, otherwise show voice button
  if (messageInput.value.trim()) {
    sendBtn.classList.remove('hidden');
    voiceRecordBtn.classList.add('hidden');
  } else {
    sendBtn.classList.add('hidden');
    voiceRecordBtn.classList.remove('hidden');
  }
});

messageInput.addEventListener('blur', () => {
  stopTyping();
});

messagesEl.addEventListener('scroll', () => {
  if (messagesEl.scrollTop < 40) {
    loadOlderMessages();
  }
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentPeer && !currentGroup) {
    alert('Select a user or group to start chatting');
    return;
  }
  if (!socket) {
    reconnectSocketIfNeeded();
  } else if (socket.disconnected && !isNetworkOffline()) {
    socket.connect();
    authStatus.textContent = 'Reconnecting... message queued';
  }
  if (currentPeer && blockedUsers.has(currentPeer.id)) {
    alert('This user is blocked. Unblock to send messages.');
    return;
  }

  const text = messageInput.value.trim();
  if (!text && !replyToMessage) return;

  stopTyping();
  
  if (currentGroup) {
    api(`/api/groups/${currentGroup._id || currentGroup.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text || '' })
    }).catch((err) => alert(`Failed to send group message: ${err.message}`));
    messageInput.value = '';
    hideReplyBar();
    return;
  }

  const payload = {
    toUserId: currentPeer.id,
    text: text || ''
  };
  
  if (replyToMessage) {
    payload.replyTo = replyToMessage.id;
  }
  
  const clientTempId = tempId();
  queueLocalMessage(payload, clientTempId);
  emitOrQueueMessage(payload, clientTempId);

  messageInput.value = '';
  hideReplyBar();
});

window.addEventListener('offline', () => {
  showInAppBanner('You are offline. You can keep chatting; messages will queue.');
});

window.addEventListener('online', async () => {
  showInAppBanner('Back online. Sending queued messages...');
  reconnectSocketIfNeeded();
  setTimeout(() => {
    flushPendingQueue();
  }, 400);
  try {
    await refreshUsers();
    await loadChats();
  } catch (_err) {}
});

let callStartTime = 0;
let currentCallType = 'voice';
let pendingIncomingCall = null;

async function startOutgoingCall(withVideo) {
  if (!currentPeer) return;
  stopIncomingRingtone();
  pendingIncomingCall = null;
  incomingCallActions?.classList.add('hidden');
  currentCallPeer = { id: currentPeer.id, username: currentPeer.username };
  currentCallType = withVideo ? 'video' : 'voice';
  callStartTime = 0;
  callUsername.textContent = `@${currentPeer.username}`;
  callAvatar.textContent = currentPeer.username.charAt(0).toUpperCase();
  callStatus.textContent = 'Calling...';
  callModal.classList.remove('hidden');
  try {
    await startCall(currentPeer.id, withVideo);
  } catch (err) {
    console.error('Failed to start call:', err);
    callModal.classList.add('hidden');
    // Log missed call
    logCall(currentPeer.id, currentPeer.username, currentCallType, 'missed', 0).catch(() => {});
    endCall(true);
    alert(`Call failed: ${err.message}`);
  }
}

voiceCallBtn.addEventListener('click', () => {
  startOutgoingCall(false);
});

videoCallBtn.addEventListener('click', () => {
  startOutgoingCall(true);
});

acceptCallBtn?.addEventListener('click', async () => {
  if (!pendingIncomingCall) return;
  stopIncomingRingtone();
  incomingCallActions?.classList.add('hidden');
  callStatus.textContent = 'Connecting...';
  try {
    await startCall(
      pendingIncomingCall.fromUserId,
      pendingIncomingCall.callType === 'video',
      pendingIncomingCall.offer
    );
    pendingIncomingCall = null;
  } catch (err) {
    console.error('Failed to accept incoming call:', err);
    if (socket && currentCallPeer) {
      socket.emit('call_end', { toUserId: currentCallPeer.id });
    }
    callModal.classList.add('hidden');
    endCall(true);
    alert(`Call failed: ${err.message}`);
  }
});

rejectCallBtn?.addEventListener('click', () => {
  stopIncomingRingtone();
  if (socket && currentCallPeer) {
    socket.emit('call_end', { toUserId: currentCallPeer.id });
  }
  pendingIncomingCall = null;
  incomingCallActions?.classList.add('hidden');
  callModal.classList.add('hidden');
  endCall(true, 'declined', 0);
});

backToChatsBtn?.addEventListener('click', () => {
  appSection.classList.remove('active-chat');
  currentPeer = null;
});

endCallBtn.addEventListener('click', () => {
  stopIncomingRingtone();
  const duration = callStartTime > 0 ? Math.round((Date.now() - callStartTime) / 1000) : 0;
  const status = callStartTime > 0 ? 'answered' : (pendingIncomingCall ? 'declined' : 'missed');
  endCall(false, status, duration);
  callModal.classList.add('hidden');
});

// Search functionality
searchBtn.addEventListener('click', () => {
  searchBar.classList.remove('hidden');
  searchInput.focus();
});

closeSearchBtn.addEventListener('click', () => {
  searchBar.classList.add('hidden');
  searchInput.value = '';
  clearSearchHighlights();
  if (messageSearchResultsEl) {
    messageSearchResultsEl.innerHTML = '';
    messageSearchResultsEl.classList.remove('active');
  }
});

function clearSearchHighlights() {
  const messageDivs = messagesEl.querySelectorAll('.message');
  messageDivs.forEach((div) => {
    div.style.background = '';
    div.style.borderRadius = '';
    div.style.outline = '';
  });
}

function formatSearchResultTime(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function jumpToSearchMessage(messageId) {
  let target = messagesEl.querySelector(`[data-message-id="${messageId}"]`);
  if (!target && currentPeer) {
    await loadMessages(currentPeer.id);
    target = messagesEl.querySelector(`[data-message-id="${messageId}"]`);
  }
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.style.outline = '2px solid #25d366';
  target.style.borderRadius = '10px';
  setTimeout(() => {
    if (target) target.style.outline = '';
  }, 1400);

  const video = target.querySelector('video');
  if (video) {
    video.play().catch(() => {});
  }
}

function renderMessageSearchResults(items) {
  if (!messageSearchResultsEl) return;
  if (!items.length) {
    messageSearchResultsEl.innerHTML = '<div class="search-result-item">No results</div>';
    messageSearchResultsEl.classList.add('active');
    return;
  }

  messageSearchResultsEl.innerHTML = '';
  items.forEach((m) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <div class="search-result-icon">🔎</div>
      <div class="search-result-preview">${escapeHtml(m.text || '[Message]')}</div>
      <div class="search-result-time">${formatSearchResultTime(m.createdAt)}</div>
    `;
    item.addEventListener('click', async () => {
      await jumpToSearchMessage(m.id);
      messageSearchResultsEl.classList.remove('active');
    });
    messageSearchResultsEl.appendChild(item);
  });
  messageSearchResultsEl.classList.add('active');
}

let searchDebounce = null;
searchInput.addEventListener('input', () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const query = searchInput.value.trim();
    if (!query) {
      clearSearchHighlights();
      if (messageSearchResultsEl) {
        messageSearchResultsEl.innerHTML = '';
        messageSearchResultsEl.classList.remove('active');
      }
      return;
    }
    if (!currentPeer) return;

    try {
      const res = await api(`/api/messages/${currentPeer.id}/search?q=${encodeURIComponent(query)}&limit=200`);
      const messageDivs = messagesEl.querySelectorAll('.message');
      const matchIds = new Set((res.messages || []).map((m) => m.id));
      messageDivs.forEach((div) => {
        if (matchIds.has(div.dataset.messageId)) {
          div.style.background = 'rgba(255, 235, 59, 0.3)';
          div.style.borderRadius = '8px';
        } else {
          div.style.background = '';
          div.style.borderRadius = '';
        }
      });
      renderMessageSearchResults(res.messages || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, 250);
});

// Pin message
pinMsgBtn.addEventListener('click', () => {
  if (!currentOptionsMessage) return;
  
  currentPinnedMessage = currentOptionsMessage;
  pinnedText.textContent = currentOptionsMessage.text || `[${currentOptionsMessage.mediaType || 'Message'}]`;
  pinnedTime.textContent = formatTime(currentOptionsMessage.createdAt);
  pinnedMessage.classList.remove('hidden');
  
  hideMessageOptions();
});

unpinMsgBtn.addEventListener('click', () => {
  currentPinnedMessage = null;
  pinnedMessage.classList.add('hidden');
});

// Quick actions
let currentQuickActionMessage = null;

function showQuickActions(message, bubble) {
  currentQuickActionMessage = message;
  
  // Position the quick actions
  const rect = bubble.getBoundingClientRect();
  quickActions.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  quickActions.style.left = `${rect.left + rect.width / 2}px`;
  quickActions.classList.add('visible');
}

function hideQuickActions() {
  quickActions.classList.remove('visible');
  currentQuickActionMessage = null;
}

// Update bubble click to show quick actions on long press (simulated with click)
const originalClick = addMessage.toString();
// Override bubble click handler
document.addEventListener('click', (e) => {
  if (!e.target.closest('.quick-actions') && !e.target.closest('.message-bubble')) {
    hideQuickActions();
  }
});

// Update message options to also show quick actions
const oldShowMessageOptions = window.showMessageOptions || function() {};
window.showMessageOptions = function(message, bubble) {
  showQuickActions(message, bubble);
  oldShowMessageOptions(message, bubble);
};

// Quick actions button handlers
quickActions.querySelectorAll('.quick-action').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!currentQuickActionMessage) return;
    
    const action = btn.dataset.action;
    
    switch (action) {
      case 'copy':
        const text = currentQuickActionMessage.text;
        if (text) {
          navigator.clipboard.writeText(text);
        }
        break;
        
      case 'reply':
        showReplyBar(currentQuickActionMessage);
        break;
        
      case 'forward':
        const recipient = prompt('Enter username to forward to:');
        if (recipient) {
          try {
            const usersData = await api('/api/users');
            const user = usersData.users.find(u => u.username.toLowerCase() === recipient.toLowerCase());
            if (user) {
              await api(`/api/messages/${currentQuickActionMessage.id}/forward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toUserId: user.id })
              });
              alert('Message forwarded!');
            } else {
              alert('User not found');
            }
          } catch (err) {
            alert('Failed to forward: ' + err.message);
          }
        }
        break;
        
      case 'pin':
        currentPinnedMessage = currentQuickActionMessage;
        pinnedText.textContent = currentQuickActionMessage.text || `[${currentQuickActionMessage.mediaType || 'Message'}]`;
        pinnedTime.textContent = formatTime(currentQuickActionMessage.createdAt);
        pinnedMessage.classList.remove('hidden');
        break;
        
      case 'delete':
        if (currentQuickActionMessage.fromUserId !== me?.id) return;
        if (confirm('Delete message for everyone?')) {
          try {
            await api(`/api/messages/${currentQuickActionMessage.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deleteForAll: true })
            });
          } catch (err) {
            alert('Failed to delete: ' + err.message);
          }
        }
        break;
    }
    
    hideQuickActions();
  });
});
