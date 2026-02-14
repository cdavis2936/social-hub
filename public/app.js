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
let reels = [];
let currentReel = null;
let reelComments = [];
let currentViewingReel = null;
let reelFileInput = null;
let posts = [];
let exploreResults = { users: [], posts: [] };
let trendingHashtags = [];

// Helper to get DOM elements
const el = (id) => document.getElementById(id);

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
const pinnedMessage = el('pinnedMessage');
const pinnedText = el('pinnedText');
const pinnedTime = el('pinnedTime');
const pinMsgBtn = el('pinMsgBtn');
const unpinMsgBtn = el('unpinMsgBtn');
const reelsSidebarFeed = el('reelsSidebarFeed');
const reelsTab = el('reelsTab');
const postsFeed = el('postsFeed');
const exploreTab = el('exploreTab');
const exploreSearch = el('exploreSearch');
const trendingHashtagsEl = el('trendingHashtags');
const exploreResultsEl = el('exploreResults');
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
let peerKeys = {};
let chatSummaries = new Map();
let blockedUsers = new Set(JSON.parse(localStorage.getItem('blockedUsers') || '[]'));
let mutedUsers = new Set(JSON.parse(localStorage.getItem('mutedUsers') || '[]'));
let archivedUsers = new Set(JSON.parse(localStorage.getItem('archivedUsers') || '[]'));
let pinnedChats = new Set(JSON.parse(localStorage.getItem('pinnedChats') || '[]'));
let pendingMessageQueue = JSON.parse(localStorage.getItem('pendingMessageQueue') || '[]');
let pendingMessageTimers = new Map();
let currentMessagesCursor = null;
let hasMoreMessages = false;
let loadingOlderMessages = false;
let loadedPeerId = null;
let lastTypingResetTimeout = null;
let userSearchTerm = '';
let reelOutcomeNotices = new Set();

const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{"enabled":false,"sound":true,"vibrate":false}');

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

// Elements moved to top of file

// Initialize
(async () => {
  renderAuth();
  applySettingsUI();
  if (token && me) {
    try {
      await loadMeProfile();
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
  if (!notificationSettings.enabled || mutedUsers.has(message.fromUserId)) return;

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const from = users.find((u) => u.id === message.fromUserId)?.username || message.fromUsername || 'User';
    new Notification(`@${from}`, { body: messagePreview(message), silent: !notificationSettings.sound });
  }

  if (notificationSettings.sound) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      setTimeout(() => ctx.close(), 120);
    } catch (_) {}
  }

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
    } else if (tabName === 'reels') {
      loadReels();
    } else if (tabName === 'posts') {
      loadPosts();
    } else if (tabName === 'explore') {
      loadExplore();
    }
  }
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchToTab(tab.dataset.tab);
  });
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
    searchResults = [];
    loadChats();
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
  if (!userSearchInput || !userSearchInput.value.trim()) {
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
  
  userSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (!query) {
      searchResults = [];
      loadChats();
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
      searchResults = [];
      loadChats();
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
      img.src = message.mediaUrl;
      img.alt = 'Image';
      bubble.appendChild(img);
    } else if (message.mediaType === 'video') {
      const video = document.createElement('video');
      video.src = message.mediaUrl;
      video.controls = true;
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
    
    storyItem.onclick = () => openStoryViewer(story, highlights);
    
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
    
    storyItem.onclick = () => openStoryViewer(latestStory, userStories);
    
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
    
    storyItem.onclick = () => openStoryViewer(latestStory, userStories);
    
    storiesList.appendChild(storyItem);
  });
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
  if (
    mediaUrl.startsWith('http://') ||
    mediaUrl.startsWith('https://') ||
    mediaUrl.startsWith('data:') ||
    mediaUrl.startsWith('blob:')
  ) {
    return mediaUrl;
  }
  if (mediaUrl.startsWith('/')) return `${window.location.origin}${mediaUrl}`;
  return `${window.location.origin}/${mediaUrl}`;
}

function inferStoryMediaKind(mediaType, mediaUrl) {
  const urlExt = String(mediaUrl || '').split('?')[0].split('#')[0].split('.').pop().toLowerCase();
  const videoExts = new Set(['mp4', 'webm', 'ogg', 'mov', 'm4v']);
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

  if (imageExts.has(urlExt)) return { kind: 'image', urlExt };
  if (videoExts.has(urlExt)) return { kind: 'video', urlExt };

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

  const mediaSrc = resolveMediaSrc(story.mediaUrl);
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
    if (mediaChanged || storyVideo.src !== mediaSrc) {
      storyVideo.src = mediaSrc;
      storyVideo.preload = 'metadata';
      storyVideo.setAttribute('playsinline', '');
      storyVideo.setAttribute('webkit-playsinline', '');
      storyVideo.controls = true;
      storyVideo.load();
    }
    storyVideo.play().catch(() => {});
  } else {
    // Treat as image
    storyVideo.pause();
    storyVideo.removeAttribute('src');
    storyVideo.load();
    storyVideo.style.display = 'none';
    storyImage.style.display = 'block';
    if (mediaChanged || storyImage.src !== mediaSrc) {
      storyImage.src = mediaSrc;
      storyImage.crossOrigin = 'anonymous';
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
      const src = resolveMediaSrc(currentStory.mediaUrl);
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
  
  if (storyVideoRetryCount >= STORY_MEDIA_MAX_RETRIES) {
    console.warn('Story video retry limit reached:', currentStory.mediaUrl);
    return;
  }

  // Try to reload a limited number of times if network is online
  if (navigator.onLine) {
    storyVideoRetryCount += 1;
    if (storyVideoRetryTimer) clearTimeout(storyVideoRetryTimer);
    storyVideoRetryTimer = setTimeout(() => {
      const src = resolveMediaSrc(currentStory.mediaUrl);
      if (!src) return;
      storyVideo.src = '';
      storyVideo.src = src;
      storyVideo.load();
    }, 1000);
  }
});

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
    }
  }

  if (uploaded.length) {
    // Refresh both sections
    await loadStories();
  }
  if (uploaded.length !== files.length) {
    alert(`Uploaded ${uploaded.length}/${files.length} stories`);
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
  }
}

function flushPendingQueue() {
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
  socket = io({ auth: { token } });

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

  // Reels real-time events
  socket.on('reel_updated', ({ reelId, status, reason }) => {
    console.log('Reel updated:', reelId, status, reason || '');
    if ((status === 'REJECTED' || status === 'FAILED') && reason) {
      const noticeKey = `${reelId}:${status}:${reason}`;
      if (!reelOutcomeNotices.has(noticeKey)) {
        reelOutcomeNotices.add(noticeKey);
        alert(`Reel ${status.toLowerCase()}: ${reason}`);
      }
    }
    if (activeTab === 'reels') {
      loadReels();
    }
  });

  socket.on('reel_liked', ({ reelId, likes }) => {
    const idx = reels.findIndex(r => r._id === reelId);
    if (idx !== -1) {
      reels[idx].likes = likes;
      renderReels();
    }
    if (currentViewingReel && currentViewingReel._id === reelId) {
      currentViewingReel.likes = likes;
      const likesEl = el('reelLikesCount');
      if (likesEl) likesEl.textContent = likes;
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
    currentCallPeer = { id: fromUserId, username: fromUsername };
    currentCallType = callType === 'video' ? 'video' : 'audio';
    callStartTime = 0; // Will be set when call is accepted
    callUsername.textContent = `@${fromUsername}`;
    callAvatar.textContent = fromUsername.charAt(0).toUpperCase();
    callStatus.textContent = `Incoming ${currentCallType} call...`;
    callModal.classList.remove('hidden');
    
    try {
      await startCall(fromUserId, currentCallType === 'video', offer);
    } catch (err) {
      console.error('Failed to accept incoming call:', err);
      callModal.classList.add('hidden');
      // Log missed/declined call
      logCall(fromUserId, fromUsername, currentCallType, 'declined', 0).catch(() => {});
      endCall(true);
      alert(`Call failed: ${err.message}`);
    }
  });

  socket.on('call_answer', async ({ answer }) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      callStatus.textContent = 'Call connected';
      callStartTime = Date.now(); // Start tracking duration
    }
  });

  socket.on('ice_candidate', async ({ candidate }) => {
    if (peerConnection && candidate) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (_e) {}
    }
  });

  socket.on('call_end', () => {
    endCall(true);
    callModal.classList.add('hidden');
  });
}

// Reels
async function loadReels() {
  try {
    const data = await api('/api/reels');
    reels = data.reels || [];
    renderReels();
    createReelUploadButton();
  } catch (err) {
    console.error('Failed to load reels:', err);
    reels = [];
    renderReels();
  }
}

async function handleReelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Check file size (max 100MB)
  if (file.size > 100 * 1024 * 1024) {
    alert('Video file is too large. Maximum size is 100MB.');
    return;
  }
  
  const caption = prompt('Enter a caption for your reel (optional):');
  if (caption === null) return; // Cancelled
  
  const formData = new FormData();
  formData.append('video', file);
  if (caption) formData.append('caption', caption);
  
  try {
    const response = await fetch('/api/reels', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Upload failed');
    }
    
    alert('Reel uploaded successfully! It will be available once processed.');
    
    // Reload reels
    loadReels();
  } catch (err) {
    console.error('Failed to upload reel:', err);
    alert('Failed to upload reel: ' + err.message);
  }
  
  // Reset input
  e.target.value = '';
}

function createReelUploadButton() {
  // Re-get the element in case it's not available at startup
  const reelsTabEl = el('reelsTab');
  if (!reelsTabEl) {
    console.warn('Reels tab not found');
    return;
  }
  
  if (el('reelUploadBtn')) return;
  
  // Create hidden file input
  reelFileInput = document.createElement('input');
  reelFileInput.type = 'file';
  reelFileInput.accept = 'video/*';
  reelFileInput.style.display = 'none';
  reelFileInput.onchange = handleReelUpload;
  document.body.appendChild(reelFileInput);
  
  // Create upload button in reels tab
  const uploadBtn = document.createElement('button');
  uploadBtn.id = 'reelUploadBtn';
  uploadBtn.className = 'btn';
  uploadBtn.style.cssText = 'width:100%;margin:8px 0;padding:12px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;';
  uploadBtn.innerHTML = '📹 Upload Reel';
  uploadBtn.onclick = () => reelFileInput.click();
  
  // Insert at top of reels tab
  reelsTabEl.insertBefore(uploadBtn, reelsTabEl.firstChild);
}

function renderReels() {
  if (!reelsSidebarFeed) return;
  
  reelsSidebarFeed.innerHTML = '';
  
  if (reels.length === 0) {
    reelsSidebarFeed.innerHTML = '<div class="list-empty">No reels yet. Be the first to upload!</div>';
    return;
  }
  
  reels.forEach(reel => {
    const thumb = document.createElement('div');
    thumb.className = 'reel-thumb';
    
    const video = document.createElement('video');
    video.src = reel.videoUrl || reel.sourceVideoUrl;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'reel-thumb-overlay';
    overlay.innerHTML = `<span>❤️ ${reel.likes || 0}</span>`;
    
    thumb.appendChild(video);
    thumb.appendChild(overlay);
    
    thumb.onclick = () => openReelViewer(reel);
    
    // Play on hover
    thumb.onmouseenter = () => video.play().catch(() => {});
    thumb.onmouseleave = () => {
      video.pause();
      video.currentTime = 0;
    };
    
    reelsSidebarFeed.appendChild(thumb);
  });
}

function openReelViewer(reel) {
  currentViewingReel = reel;
  
  // Create modal if not exists
  let reelModal = el('reelModal');
  if (!reelModal) {
    reelModal = document.createElement('div');
    reelModal.id = 'reelModal';
    reelModal.className = 'story-modal';
    reelModal.innerHTML = `
      <div class="story-viewer">
        <div class="story-progress">
          <div class="progress-bar" id="reelProgressBar"></div>
        </div>
        <button class="story-close" id="closeReelBtn">&times;</button>
        <div class="story-content" id="reelContent">
          <video id="reelVideo" controls style="max-height:80vh;max-width:100%;"></video>
        </div>
        <div class="reel-info" id="reelInfo" style="padding:16px;background:#fff;border-top:1px solid #ddd;">
          <div class="reel-user" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div class="avatar" id="reelUserAvatar" style="width:40px;height:40px;border-radius:50%;background:#ccc;display:flex;align-items:center;justify-content:center;"></div>
            <div>
              <div class="reel-username" id="reelUsername" style="font-weight:600;"></div>
              <div class="reel-caption" id="reelCaption" style="color:#666;font-size:14px;"></div>
            </div>
          </div>
          <div class="reel-actions" style="display:flex;gap:16px;margin-bottom:12px;">
            <button class="btn" id="likeReelBtn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;">
              <span>❤️</span> <span id="reelLikesCount">0</span> Likes
            </button>
            <button class="btn btn-secondary" id="viewCommentsBtn" style="flex:1;">View Comments</button>
          </div>
          <div class="reel-comments-section" id="reelCommentsSection" style="display:none;">
            <div class="comments-list" id="reelCommentsList" style="max-height:200px;overflow-y:auto;margin-bottom:12px;"></div>
            <div style="display:flex;gap:8px;">
              <input type="text" id="reelCommentInput" placeholder="Add a comment..." style="flex:1;padding:8px;border:1px solid #ddd;border-radius:20px;">
              <button class="btn" id="sendReelCommentBtn">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(reelModal);
    
    // Event listeners
    el('closeReelBtn').onclick = () => closeReelViewer();
    el('likeReelBtn').onclick = () => likeCurrentReel();
    el('viewCommentsBtn').onclick = () => toggleReelComments();
    el('sendReelCommentBtn').onclick = () => sendReelComment();
    el('reelCommentInput').onkeypress = (e) => {
      if (e.key === 'Enter') sendReelComment();
    };
  }
  
  // Populate reel data
  const video = el('reelVideo');
  video.src = reel.videoUrl || reel.sourceVideoUrl;
  
  el('reelUsername').textContent = reel.username || 'User';
  el('reelUserAvatar').textContent = (reel.username || 'U').charAt(0).toUpperCase();
  el('reelCaption').textContent = reel.caption || '';
  el('reelLikesCount').textContent = reel.likes || 0;
  
  reelModal.classList.remove('hidden');
  
  // Load comments
  loadReelComments(reel._id);
}

function closeReelViewer() {
  const reelModal = el('reelModal');
  if (reelModal) {
    reelModal.classList.add('hidden');
    const video = el('reelVideo');
    if (video) video.pause();
  }
  currentViewingReel = null;
}

async function likeCurrentReel() {
  if (!currentViewingReel) return;
  
  try {
    const data = await api(`/api/reels/${currentViewingReel._id}/like`, 'POST');
    if (data.reel) {
      currentViewingReel.likes = data.reel.likes;
      el('reelLikesCount').textContent = data.reel.likes || 0;
      
      // Update in reels array
      const idx = reels.findIndex(r => r._id === currentViewingReel._id);
      if (idx !== -1) reels[idx].likes = data.reel.likes;
      renderReels();
    }
  } catch (err) {
    console.error('Failed to like reel:', err);
    alert('Failed to like reel');
  }
}

async function loadReelComments(reelId) {
  try {
    const data = await api(`/api/reels/${reelId}/comments`);
    reelComments = data.comments || [];
    renderReelComments();
  } catch (err) {
    console.error('Failed to load comments:', err);
    reelComments = [];
  }
}

function renderReelComments() {
  const list = el('reelCommentsList');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (reelComments.length === 0) {
    list.innerHTML = '<div style="color:#999;text-align:center;padding:12px;">No comments yet</div>';
    return;
  }
  
  reelComments.forEach(comment => {
    const item = document.createElement('div');
    item.style.padding = '8px 0';
    item.style.borderBottom = '1px solid #f0f0f0';
    item.innerHTML = `<strong>${escapeHtml(comment.username)}</strong> ${escapeHtml(comment.text)}`;
    list.appendChild(item);
  });
}

function toggleReelComments() {
  const section = el('reelCommentsSection');
  if (section) {
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
  }
}

async function sendReelComment() {
  if (!currentViewingReel) return;
  
  const input = el('reelCommentInput');
  const text = input.value.trim();
  if (!text) return;
  
  try {
    const data = await api(`/api/reels/${currentViewingReel._id}/comments`, 'POST', { text });
    if (data.comment) {
      reelComments.unshift(data.comment);
      renderReelComments();
      input.value = '';
    }
  } catch (err) {
    console.error('Failed to add comment:', err);
    alert('Failed to add comment');
  }
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
        video.src = media.url;
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
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
          video.src = m.url;
          video.controls = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.style.cssText = 'width:200px;height:250px;object-fit:cover;border-radius:4px;scroll-snap-align:start;';
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
  postFileInput.style.display = 'none';
  postFileInput.onchange = handlePostUpload;
  document.body.appendChild(postFileInput);
  
  createPostBtn.onclick = () => postFileInput.click();
}

async function handlePostUpload(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  const caption = prompt('Enter a caption for your post:');
  const location = prompt('Enter location (optional):');
  
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

// ============================================
// Explore / Search
// ============================================
async function loadExplore() {
  try {
    // Load trending hashtags
    const trendingData = await api('/api/trending/hashtags');
    trendingHashtags = trendingData.hashtags || [];
    renderTrendingHashtags();
    
    // Load explore feed
    const exploreData = await api('/api/explore');
    exploreResults.posts = exploreData.posts || [];
    renderExploreResults();
  } catch (err) {
    console.error('Failed to load explore:', err);
  }
}

function renderTrendingHashtags() {
  if (!trendingHashtagsEl) return;
  
  trendingHashtagsEl.innerHTML = '';
  
  trendingHashtags.forEach(tag => {
    const span = document.createElement('span');
    span.style.cssText = 'background:#f0f0f0;padding:4px 10px;border-radius:12px;font-size:12px;cursor:pointer;';
    span.textContent = `#${tag.tag} (${tag.count})`;
    span.onclick = () => searchHashtag(tag.tag);
    trendingHashtagsEl.appendChild(span);
  });
}

function renderExploreResults() {
  if (!exploreResultsEl) return;
  
  exploreResultsEl.innerHTML = '';
  
  if (exploreResults.posts.length === 0) {
    exploreResultsEl.innerHTML = '<div class="list-empty">No posts to explore</div>';
    return;
  }
  
  // Show as grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:4px;';
  
  exploreResults.posts.forEach(post => {
    const item = document.createElement('div');
    item.style.cssText = 'aspect-ratio:1;overflow:hidden;cursor:pointer;position:relative;';

    const mediaItems = Array.isArray(post.media) ? post.media : [];
    const firstMedia = mediaItems[0] || null;
    let previewEl;

    if (firstMedia?.type === 'video') {
      const video = document.createElement('video');
      video.src = firstMedia.url;
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      // Best-effort autoplay in browsers with strict policies.
      video.play().catch(() => {});
      item.onmouseenter = () => {
        overlay.style.opacity = '1';
        video.play().catch(() => {});
      };
      item.onmouseleave = () => {
        overlay.style.opacity = '0';
        video.pause();
      };
      previewEl = video;
    } else {
      const img = document.createElement('img');
      img.src = firstMedia?.url || '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      item.onmouseenter = () => overlay.style.opacity = '1';
      item.onmouseleave = () => overlay.style.opacity = '0';
      previewEl = img;
    }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;padding:4px;display:flex;justify-content:space-around;font-size:12px;opacity:0;transition:opacity 0.2s;';
    overlay.innerHTML = '<span>❤️ ' + (post.likesCount || 0) + '</span><span>💬 ' + (post.commentsCount || 0) + '</span>';
    
    item.appendChild(previewEl);
    item.appendChild(overlay);
    grid.appendChild(item);
  });
  
  exploreResultsEl.appendChild(grid);
}

async function searchHashtag(tag) {
  try {
    const data = await api(`/api/hashtag/${tag}`);
    exploreResults.posts = data.posts || [];
    renderExploreResults();
  } catch (err) {
    console.error('Failed to search hashtag:', err);
  }
}

// Search handler
if (exploreSearch) {
  let searchTimeout;
  exploreSearch.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const query = exploreSearch.value.trim();
      if (query.length < 2) {
        loadExplore();
        return;
      }
      
      try {
        const data = await api(`/api/search?q=${encodeURIComponent(query)}&type=all`);
        exploreResults = { users: data.users || [], posts: data.posts || [] };
        renderExploreResults();
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 500);
  };
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

async function startCall(peerId, withVideo, offer) {
  localStream = await getUserMediaSafe({ audio: true, video: withVideo });
  localVideo.srcObject = localStream;
  
  peerConnection = new RTCPeerConnection(rtcConfig);
  peerConnection.ontrack = (evt) => {
    remoteVideo.srcObject = evt.streams[0];
  };
  peerConnection.onicecandidate = (evt) => {
    if (evt.candidate) {
      socket.emit('ice_candidate', { toUserId: peerId, candidate: evt.candidate });
    }
  };

  for (const track of localStream.getTracks()) {
    peerConnection.addTrack(track, localStream);
  }

  if (offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('call_answer', { toUserId: peerId, answer });
    callStatus.textContent = 'Call connected';
  } else {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call_offer', { toUserId: peerId, offer, callType: withVideo ? 'video' : 'voice' });
    callStatus.textContent = 'Calling...';
  }
}

function endCall(fromRemote = false, status = 'missed', duration = 0) {
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
    socket.emit('call_end', { toUserId: currentCallPeer.id });
  }
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
      selectUser({ id: call.peerId, username: call.peerUsername });
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

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const action = e.submitter?.dataset?.action;
  const username = el('username').value.trim();
  const password = el('password').value;

  try {
    authStatus.textContent = '';
    const endpoint = action === 'register' ? '/api/auth/register' : '/api/auth/login';
    const data = await api(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    saveSession(data.token, data.user);
    await loadMeProfile();
    renderAuth();
    showApp();
    setupSocket();
    await refreshUsers();
    await loadChats();
    await loadGroups();
    await loadStories();
  } catch (err) {
    authStatus.textContent = err.message;
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
    alert('Socket not initialized. Please refresh and log in again.');
    return;
  }
  if (socket.disconnected) {
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

let callStartTime = 0;
let currentCallType = 'audio';

async function startOutgoingCall(withVideo) {
  if (!currentPeer) return;
  currentCallPeer = { id: currentPeer.id, username: currentPeer.username };
  currentCallType = withVideo ? 'video' : 'audio';
  callStartTime = Date.now();
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

backToChatsBtn?.addEventListener('click', () => {
  appSection.classList.remove('active-chat');
  currentPeer = null;
});

endCallBtn.addEventListener('click', () => {
  const duration = callStartTime > 0 ? Math.round((Date.now() - callStartTime) / 1000) : 0;
  const status = callStartTime > 0 ? 'answered' : 'missed';
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
});

let searchDebounce = null;
searchInput.addEventListener('input', () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const query = searchInput.value.trim();
    const messageDivs = messagesEl.querySelectorAll('.message');
    if (!query) {
      messageDivs.forEach((div) => {
        div.style.background = '';
        div.style.borderRadius = '';
      });
      return;
    }
    if (!currentPeer) return;

    try {
      const res = await api(`/api/messages/${currentPeer.id}/search?q=${encodeURIComponent(query)}&limit=200`);
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
