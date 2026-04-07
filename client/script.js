const API_URL = '/api';
let socket;
let currentUser = null;
let currentChat = null;
let users = [];
let onlineUsersList = [];
let unreadCounts = {};
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
let originalTitle = document.title;

// DOM Elements
const authContainer = document.getElementById('auth-view');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const logoutBtn = document.getElementById('logout-btn');
const usersList = document.getElementById('users-list');
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const attachBtn = document.getElementById('attach-btn');
const mediaInput = document.getElementById('media-input');
const sendBtn = document.getElementById('send-btn');
const currentChatName = document.getElementById('current-chat-name');
const typingIndicator = document.getElementById('typing-indicator');
const smartReplies = document.getElementById('smart-replies');
const sidebar = document.getElementById('sidebar');
const mainChat = document.querySelector('.bg-chat');
const backBtn = document.getElementById('back-btn');
const userSearchInput = document.getElementById('user-search');

// Profile DOM Elements
const myProfilePic = document.getElementById('my-profile-pic');
const myUsernameDisplay = document.getElementById('my-username');
const profilePicModal = document.getElementById('modal-profile-pic');
const profileUpload = document.getElementById('profile-upload');
const profileUsername = document.getElementById('modal-username');
const profileBio = document.getElementById('modal-bio');
const saveProfileBtn = document.getElementById('save-profile-btn');

// WebRTC / Call DOM Elements
const videoCallBtn = document.getElementById('video-call-btn');
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallOverlay = document.getElementById('video-call-overlay');
const incomingCallModal = document.getElementById('incoming-call-modal');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const endCallBtn = document.getElementById('end-call-btn');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');
const callerNameDisplay = document.getElementById('caller-name');
const callerInitialDisplay = document.getElementById('caller-initial');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleVideoBtn = document.getElementById('toggle-video-btn');
const callTimerDisplay = document.getElementById('call-timer');
const ringingUI = document.getElementById('call-ringing-ui');
const ringAvatar = document.getElementById('ring-avatar');
const ringName = document.getElementById('ring-name');
const ringStatus = document.getElementById('ring-status');

// WebRTC State
let localStream = null;
let peer = null;
let incomingCallData = null;
let isMuted = false;
let isVideoOff = false;
let callDurationTimer = null;
let secondsElapsed = 0;
let callType = 'video'; // 'voice' or 'video'
const callRingtone = new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3');
const outgoingRingtone = new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3');
const callEndSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
callRingtone.loop = true;
outgoingRingtone.loop = true;

// Initialize app
function init() {
    const user = localStorage.getItem('chatAppUser');
    if (user) {
        currentUser = JSON.parse(user);
        showChatView();
        connectSocket();
        fetchUsers();
    }
}

// Show/Hide Views
function showChatView() {
    authContainer.classList.add('d-none');
    authContainer.classList.remove('d-flex');
    chatContainer.classList.remove('d-none');
    
    myUsernameDisplay.innerText = currentUser.username;
    if (currentUser.profilePic) myProfilePic.src = currentUser.profilePic;
    
    // Mobile View Setup
    if (window.innerWidth <= 768) {
        mainChat.classList.add('hidden-mobile');
        sidebar.classList.remove('hidden-mobile');
    }
}

function showAuthView() {
    localStorage.removeItem('chatAppUser');
    currentUser = null;
    currentChat = null;
    if (socket) socket.disconnect();
    chatContainer.classList.add('d-none');
    authContainer.classList.remove('d-none');
    authContainer.classList.add('d-flex');
}

// Authentication
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('chatAppUser', JSON.stringify(data));
            currentUser = data;
            showChatView();
            connectSocket();
            fetchUsers();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Server error');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('chatAppUser', JSON.stringify(data));
            currentUser = data;
            showChatView();
            connectSocket();
            fetchUsers();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Server error');
    }
});

logoutBtn.addEventListener('click', showAuthView);

// Password Visibility toggles
function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    
    icon.addEventListener('click', () => {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
}
togglePassword('login-password', 'toggle-login-pass');
togglePassword('reg-password', 'toggle-reg-pass');
togglePassword('reg-confirm-password', 'toggle-reg-confirm-pass');

// Fetch users
async function fetchUsers() {
    try {
        const res = await fetch(`${API_URL}/auth/users`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        const data = await res.json();
        if (res.ok) {
            users = data;
            renderUsers();
        }
    } catch (err) {
        console.error('Error fetching users:', err);
    }
}

// Time Formatting function for Last Seen
function timeSince(date) {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return "just now";
}

function renderUsers() {
    const searchTerm = userSearchInput ? userSearchInput.value.toLowerCase().trim() : '';
    const filteredUsers = users.filter(user => user.username.toLowerCase().includes(searchTerm));

    usersList.innerHTML = '';
    
    if (filteredUsers.length === 0) {
        usersList.innerHTML = '<div class="p-4 text-center text-muted">No users found.</div>';
        return;
    }

    filteredUsers.forEach(user => {
        const isOnline = onlineUsersList.includes(user._id);
        const unreadCount = unreadCounts[user._id] || 0;
        
        const div = document.createElement('div');
        div.className = 'user-item p-3 d-flex align-items-center position-relative';
        if (currentChat && currentChat.users.some(u => u._id === user._id)) {
            div.classList.add('active');
        }

        // Online or Last Seen text
        const statusText = isOnline 
            ? `<small class="text-success fw-bold">Active now</small>` 
            : `<small class="text-muted">Last seen: ${timeSince(user.lastSeen)}</small>`;

        let profilePicUrl = user.profilePic || defaultAvatar;
        // Sanitize: Replace double quotes with single quotes to prevent breaking the src attribute
        if (profilePicUrl.startsWith('data:image')) {
            profilePicUrl = profilePicUrl.replace(/"/g, "'");
        }
        div.innerHTML = `
            <div class="position-relative me-3">
                <img src="${profilePicUrl}" class="rounded-circle shadow-sm" style="width: 45px; height: 45px; object-fit: cover; border: 2px solid ${isOnline ? '#22c55e' : '#ccc'};">
                <span class="status-dot ${isOnline ? 'online' : ''} position-absolute bottom-0 end-0 border border-white border-2"></span>
            </div>
            <div class="flex-grow-1">
                <h6 class="mb-0 fw-bold">${user.username}</h6>
                ${statusText}
            </div>
            ${unreadCount > 0 ? `<span class="badge bg-danger rounded-pill position-absolute end-0 me-3">${unreadCount}</span>` : ''}
        `;
        
        div.addEventListener('click', () => {
            document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            
            // Clear unread notifications
            unreadCounts[user._id] = 0;
            document.title = originalTitle;
            renderUsers(); // Refresh to remove badge

            accessChat(user._id, user.username);
            
            // Mobile switch to chat
            if (window.innerWidth <= 768) {
                sidebar.classList.add('hidden-mobile');
                mainChat.classList.remove('hidden-mobile');
            }
        });
        
        usersList.appendChild(div);
    });
}

// User Search event logic
if (userSearchInput) {
    userSearchInput.addEventListener('input', () => {
        renderUsers();
    });
}

// Mobile back button
backBtn.addEventListener('click', () => {
    mainChat.classList.add('hidden-mobile');
    sidebar.classList.remove('hidden-mobile');
    currentChat = null;
});

// Create/Access Chat
async function accessChat(userId, username) {
    try {
        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        
        if (res.ok) {
            currentChat = data;
            currentChatName.innerText = username;
            messageInput.disabled = false;
            sendBtn.disabled = false;
            videoCallBtn.classList.remove('d-none');
            voiceCallBtn.classList.remove('d-none');
            socket.emit('join chat', currentChat._id);
            fetchMessages();
        }
    } catch (err) {
        console.error('Error accessing chat:', err);
    }
}

// Fetch Messages
async function fetchMessages() {
    if (!currentChat) return;
    
    try {
        const res = await fetch(`${API_URL}/chat/${currentChat._id}`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
            renderMessages(data);
            socket.emit("join chat", currentChat._id);
            socket.emit("mark chat seen", { chatId: currentChat._id, userId: currentUser._id });
            
            // Smart replies on latest message if not sent by me
            if (data.length > 0) {
                const latest = data[data.length - 1];
                if(latest.sender._id !== currentUser._id) {
                    generateSmartReplies(latest.content);
                } else {
                    smartReplies.classList.add('d-none');
                }
            } else {
                smartReplies.classList.add('d-none');
            }
        }
    } catch (err) {
        console.error('Error fetching msg:', err);
    }
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="fa-regular fa-comment-dots fa-3x mb-3 opacity-50"></i>
                <p>No messages yet. Say hi!</p>
            </div>
        `;
        return;
    }
    
    chatMessages.innerHTML = '';
    messages.forEach(msg => {
        appendMessageUI(msg);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getTickHtml(status, isMine) {
    if (!isMine) return '';
    if (status === 'seen') return '<span style="color:#00a884; font-weight:bold;">✓✓</span>'; // WhatsApp blue
    if (status === 'delivered') return '<span style="color:#888;">✓✓</span>';
    return '<span style="color:#888;">✓</span>';
}

function appendMessageUI(msg) {
    // Remove blank state if exists
    if(chatMessages.querySelector('.opacity-50')) {
        chatMessages.innerHTML = '';
    }

    if (msg.isCallLog) {
        const div = document.createElement('div');
        div.className = 'd-flex justify-content-center w-100';
        div.innerHTML = `<div class="message-call-log shadow-sm" style="background:#f1f5f9; color:#475569; padding: 6px 16px; border-radius: 12px; margin: 12px 0; font-size: 13px;">
                            ${msg.content}
                         </div>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
    }

    const isMine = msg.sender._id === currentUser._id;
    const div = document.createElement('div');
    div.className = `message-bubble ${isMine ? 'message-sent' : 'message-received shadow-sm'}`;
    
    // Add ID so we can update it later
    if (msg._id) div.id = `msg-${msg._id}`;
    
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let mediaHtml = '';
    if (msg.mediaUrl) {
        mediaHtml = `<img src="${msg.mediaUrl}" class="chat-image mb-2 d-block" onclick="window.open(this.src)" />`;
    }
    
    div.innerHTML = `
        ${mediaHtml}
        ${msg.content ? `<span>${msg.content}</span>` : ''}
        <span class="message-meta">${time} <span class="msg-status" data-id="${msg._id}">${getTickHtml(msg.status || 'sent', isMine)}</span></span>
    `;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Attachment Logic
if (attachBtn && mediaInput) {
    attachBtn.addEventListener('click', () => {
        mediaInput.click();
    });

    mediaInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !currentChat) return;

        const formData = new FormData();
        formData.append('media', file);

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentUser.token}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                const msgData = {
                    content: "",
                    mediaUrl: data.url,
                    chatId: currentChat,
                    sender: { _id: currentUser._id, username: currentUser.username }
                };
                
                socket.emit('new message', msgData);
                
                // Optimistic UI update
                const optimisticMsg = {
                    ...msgData,
                    createdAt: new Date().toISOString(),
                    _id: 'temp-' + Date.now()
                };
                appendMessageUI(optimisticMsg);
            } else {
                alert("Upload failed: " + data.message);
            }
        } catch(err) {
            console.error('File upload error', err);
            alert('File upload failed');
        }
        
        // Reset input
        mediaInput.value = '';
    });
}

// Send Message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!messageInput.value.trim() || !currentChat) return;
    
    const msgData = {
        content: messageInput.value,
        mediaUrl: "",
        chatId: currentChat,
        sender: { _id: currentUser._id, username: currentUser.username }
    };
    
    socket.emit('new message', msgData);
    
    // Optimistic UI update
    const optimisticMsg = {
        ...msgData,
        createdAt: new Date().toISOString(),
         _id: 'temp-' + Date.now()
    };
    appendMessageUI(optimisticMsg);
    
    messageInput.value = '';
    socket.emit('stop typing', currentChat._id);
    smartReplies.classList.add('d-none');
});

// Typing Logic
let typingTimer;
messageInput.addEventListener('input', () => {
    if (!currentChat) return;
    
    socket.emit('typing', currentChat._id);
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('stop typing', currentChat._id);
    }, 3000);
});

// Smart Replies
async function generateSmartReplies(msgContent) {
    try {
        const res = await fetch(`${API_URL}/chat/suggest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ latestMessage: msgContent })
        });
        const data = await res.json();
        
        if (data.suggestions && data.suggestions.length > 0) {
            smartReplies.innerHTML = '';
            data.suggestions.forEach(sug => {
                const span = document.createElement('span');
                span.className = 'smart-reply-chip';
                span.innerText = sug;
                span.addEventListener('click', () => {
                    messageInput.value = sug;
                    smartReplies.classList.add('d-none');
                    messageForm.dispatchEvent(new Event('submit'));
                });
                smartReplies.appendChild(span);
            });
            smartReplies.classList.remove('d-none');
        } else {
            smartReplies.classList.add('d-none');
        }
    } catch (err) {
        console.error(err);
    }
}

// Socket Connection
function connectSocket() {
    // Auto-connect to the same host that served the frontend
    socket = io();
    
    socket.emit('setup', currentUser);
    
    socket.on('connected', () => {
        console.log('Valid socket connection');
    });
    
    socket.on('message recieved', (newMessageReceived) => {
        if (!currentChat || currentChat._id !== newMessageReceived.chatId._id) {
            // Notification Logic Trigger
            const senderId = newMessageReceived.sender._id;
            unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
            
            // Play Sound
            notificationSound.play().catch(e => console.log('Audio play blocked by browser.'));
            
            // Update Title
            document.title = `(${unreadCounts[senderId]}) New Message - Chat App`;
            
            // Re-render user list to show badge
            renderUsers();
        } else {
            appendMessageUI(newMessageReceived);
            generateSmartReplies(newMessageReceived.content);
            socket.emit("mark chat seen", { chatId: currentChat._id, userId: currentUser._id });
        }
    });

    socket.on('message status update', ({ messageId, chatId, status }) => {
        if (messageId) {
            // Update specific message
            const statusSpan = document.querySelector(`.msg-status[data-id="${messageId}"]`);
            if (statusSpan) statusSpan.innerHTML = getTickHtml(status, true);
        } else if (chatId && status === 'seen') {
            // Bulk update all ticks to seen for this chat
            const spans = document.querySelectorAll('.msg-status');
            spans.forEach(span => span.innerHTML = getTickHtml('seen', true));
        }
    });

    socket.on('typing', () => {
        typingIndicator.classList.remove('d-none');
    });
    
    socket.on('stop typing', () => {
        typingIndicator.classList.add('d-none');
    });
    
    socket.on('online users', (activeUsersArray) => {
        onlineUsersList = activeUsersArray;
        if(users.length > 0) fetchUsers(); // Re-fetch to get updated lastSeen from DB, then render Users
    });

    // WEBRTC SIGNALING
    socket.on('callUser', (data) => {
        incomingCallData = data;
        callerNameDisplay.innerText = data.name;
        callerInitialDisplay.innerText = data.name.charAt(0).toUpperCase();
        
        // Show if it's voice or video
        const typeText = data.type === 'video' ? 'Incoming Video Call...' : 'Incoming Voice Call...';
        incomingCallModal.querySelector('.text-muted').innerText = typeText;
        
        incomingCallModal.classList.remove('d-none');
        callRingtone.play().catch(e=>console.log("Audio block: ", e));
    });

    socket.on('callAccepted', (signal) => {
        if (peer) peer.signal(signal);
        
        // Stop outgoing ringtone
        outgoingRingtone.pause();
        outgoingRingtone.currentTime = 0;
        
        // Hide ringing UI
        ringingUI.classList.add('d-none');
        
        // Show core call UI
        if (callType === 'video') {
            remoteVideo.classList.remove('d-none');
            localVideo.classList.remove('d-none');
        } else {
            // It's a voice call, keep avatars visible or something
            remoteVideo.classList.add('d-none');
            localVideo.classList.add('d-none');
            ringingUI.classList.remove('d-none'); // Show avatar
            ringStatus.innerText = "In call";
        }
        
        startTimer();
    });

    socket.on('callEnded', () => {
        endCall('Remote ended');
    });
}

// Timer Logic
function startTimer() {
    clearInterval(callDurationTimer);
    secondsElapsed = 0;
    callTimerDisplay.classList.remove('d-none');
    callDurationTimer = setInterval(() => {
        secondsElapsed++;
        const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
        const secs = (secondsElapsed % 60).toString().padStart(2, '0');
        callTimerDisplay.innerText = `${mins}:${secs}`;
    }, 1000);
}

// Mute / Video Toggles
toggleMicBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (localStream) {
        localStream.getAudioTracks()[0].enabled = !isMuted;
        toggleMicBtn.classList.toggle('active', isMuted);
        toggleMicBtn.innerHTML = isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
    }
});

toggleVideoBtn.addEventListener('click', () => {
    isVideoOff = !isVideoOff;
    if (localStream && localStream.getVideoTracks().length > 0) {
        localStream.getVideoTracks()[0].enabled = !isVideoOff;
        toggleVideoBtn.classList.toggle('active', isVideoOff);
        toggleVideoBtn.innerHTML = isVideoOff ? '<i class="fa-solid fa-video-slash"></i>' : '<i class="fa-solid fa-video"></i>';
        localVideo.style.opacity = isVideoOff ? '0' : '1';
    }
});

// WEBRTC ACTIONS
async function handleStartCall(type) {
    const otherUser = currentChat.users.find(u => u._id !== currentUser._id);
    if (!onlineUsersList.includes(otherUser._id)) {
        alert("User is offline!");
        return;
    }

    callType = type;
    isCallInitiator = true;
    activeCallUserId = otherUser._id;
    isMuted = false;
    isVideoOff = false;
    
    // Show Overlay & Ringing UI
    videoCallOverlay.classList.remove('d-none');
    ringingUI.classList.remove('d-none');
    callTimerDisplay.classList.add('d-none');
    ringName.innerText = otherUser.username;
    ringStatus.innerText = "Ringing...";
    ringAvatar.src = otherUser.profilePic || defaultAvatar;
    
    // UI visibility based on type
    if (type === 'voice') {
        localVideo.classList.add('d-none');
        remoteVideo.classList.add('d-none');
        toggleVideoBtn.classList.add('d-none');
    } else {
        localVideo.classList.remove('d-none');
        remoteVideo.classList.add('d-none'); // Wait till match
        toggleVideoBtn.classList.remove('d-none');
    }

    try {
        const streamConstraints = { 
            video: type === 'video', 
            audio: true 
        };
        localStream = await navigator.mediaDevices.getUserMedia(streamConstraints);
        if (type === 'video') localVideo.srcObject = localStream;

        // Play Outgoing ringtone
        outgoingRingtone.play().catch(e => console.log("Outgoing audio block: ", e));

        peer = new SimplePeer({
            initiator: true,
            trickle: false,
            stream: localStream
        });

        peer.on('signal', data => {
            socket.emit('callUser', {
                userToCall: otherUser._id,
                signalData: data,
                from: currentUser._id,
                name: currentUser.username,
                type: type
            });
        });

        peer.on('stream', stream => {
            remoteVideo.srcObject = stream;
            if (callType === 'video') {
                remoteVideo.classList.remove('d-none');
                ringingUI.classList.add('d-none');
            }
        });
    } catch (err) {
        console.error("Call initialization error:", err);
        alert("Could not access camera/mic.");
        endCall('Permission Denied');
    }
}

videoCallBtn.addEventListener('click', () => handleStartCall('video'));
voiceCallBtn.addEventListener('click', () => handleStartCall('voice'));

acceptCallBtn.addEventListener('click', async () => {
    callRingtone.pause();
    callRingtone.currentTime = 0;
    incomingCallModal.classList.add('d-none');
    videoCallOverlay.classList.remove('d-none');
    
    isCallInitiator = false;
    activeCallUserId = incomingCallData.from;
    callType = incomingCallData.type || 'video';
    isMuted = false;
    isVideoOff = false;

    // Show Ringing/Connecting UI
    ringingUI.classList.remove('d-none');
    ringName.innerText = incomingCallData.name;
    ringStatus.innerText = "Connecting...";
    // Find sender profile pic
    const sender = users.find(u=>u._id === activeCallUserId);
    ringAvatar.src = sender ? (sender.profilePic || defaultAvatar) : defaultAvatar;

    if (callType === 'voice') {
        localVideo.classList.add('d-none');
        remoteVideo.classList.add('d-none');
        toggleVideoBtn.classList.add('d-none');
    } else {
        localVideo.classList.remove('d-none');
        remoteVideo.classList.add('d-none');
        toggleVideoBtn.classList.remove('d-none');
    }

    try {
        const streamConstraints = { 
            video: callType === 'video', 
            audio: true 
        };
        localStream = await navigator.mediaDevices.getUserMedia(streamConstraints);
        if (callType === 'video') localVideo.srcObject = localStream;

        peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: localStream
        });

        peer.on('signal', data => {
            socket.emit('answerCall', { signal: data, to: incomingCallData.from });
        });

        peer.on('stream', stream => {
            remoteVideo.srcObject = stream;
            if (callType === 'video') {
                remoteVideo.classList.remove('d-none');
                ringingUI.classList.add('d-none');
            } else {
                ringStatus.innerText = "In call";
            }
        });

        peer.signal(incomingCallData.signal);
        startTimer();
    } catch (err) {
        console.error("Camera error:", err);
        socket.emit('endCall', { to: incomingCallData.from });
        endCall('Missing Permissions');
    }
});

function endCall(reason) {
    videoCallOverlay.classList.add('d-none');
    incomingCallModal.classList.add('d-none');
    callRingtone.pause();
    callRingtone.currentTime = 0;
    outgoingRingtone.pause();
    outgoingRingtone.currentTime = 0;
    clearInterval(callDurationTimer);
    
    if (peer || localStream) {
        callEndSound.play().catch(e=>null);
    }

    // Log the call if initiator OR if it was an active call
    if (activeCallUserId && currentChat) {
        let durationStr = "Missed Call";
        let durationSec = secondsElapsed;
        
        if (durationSec > 0) {
            const m = Math.floor(durationSec / 60);
            const s = durationSec % 60;
            durationStr = `${m}m ${s}s`;
        } else if (reason === 'Remote ended' && isCallInitiator) {
             durationStr = "Declined";
        }
        
        const logMsg = {
            content: `📞 ${callType === 'video' ? 'Video' : 'Voice'} Call - ${durationStr}`,
            chatId: currentChat,
            sender: currentUser,
            isCallLog: true,
            callDuration: durationSec
        };
        
        // Only log if I'm the initiator (to avoid double logs)
        if (isCallInitiator) {
            socket.emit('new message', logMsg);
            const optimisticMsg = { ...logMsg, createdAt: new Date().toISOString(), _id: 'temp-' + Date.now() };
            appendMessageUI(optimisticMsg);
        }
    }

    if (peer) {
        peer.destroy();
        peer = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Reset UI states
    incomingCallData = null;
    isCallInitiator = false;
    activeCallUserId = null;
    secondsElapsed = 0;
    toggleMicBtn.classList.remove('active');
    toggleMicBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    toggleVideoBtn.classList.remove('active');
    toggleVideoBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
}

endCallBtn.addEventListener('click', () => {
    const toUser = incomingCallData ? incomingCallData.from : activeCallUserId;
    if (toUser) socket.emit('endCall', { to: toUser });
    endCall('I ended');
});

rejectCallBtn.addEventListener('click', () => {
    if (incomingCallData) socket.emit('endCall', { to: incomingCallData.from });
    endCall('I rejected');
});

// Init
const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";

// Handle Profile Modal Population
const profileBtn = document.getElementById('profile-btn');
if(profileBtn) {
    profileBtn.addEventListener('click', () => {
        if(currentUser) {
            profileUsername.innerText = currentUser.username;
            profileBio.value = currentUser.bio || '';
            profilePicModal.src = currentUser.profilePic || defaultAvatar;
        }
    });

}

let cropper = null;
const profileViewArea = document.getElementById('profile-view-area');
const cropperArea = document.getElementById('cropper-area');
const cropperImage = document.getElementById('cropper-image');
const cancelCropBtn = document.getElementById('cancel-crop-btn');
const saveCropBtn = document.getElementById('save-crop-btn');

// Start Cropping Session
profileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        profileViewArea.classList.add('d-none');
        cropperArea.classList.remove('d-none');
        cropperImage.src = event.target.result;

        if (cropper) cropper.destroy();

        cropper = new Cropper(cropperImage, {
            aspectRatio: 1, // perfect square
            viewMode: 1,
            dragMode: 'move'
        });
    };
    reader.readAsDataURL(file);
    profileUpload.value = ''; // Reset input
});

cancelCropBtn.addEventListener('click', () => {
    cropperArea.classList.add('d-none');
    profileViewArea.classList.remove('d-none');
    if (cropper) cropper.destroy();
});

// Save Cropped Image
saveCropBtn.addEventListener('click', () => {
    if (!cropper) return;
    saveCropBtn.disabled = true;
    saveCropBtn.innerText = "Saving...";

    cropper.getCroppedCanvas({
        width: 400,
        height: 400
    }).toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('media', blob, "profile.jpg");

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentUser.token}`
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                currentUser.profilePic = data.url;
                profilePicModal.src = currentUser.profilePic;
                
                // Revert UI
                cropperArea.classList.add('d-none');
                profileViewArea.classList.remove('d-none');
                if (cropper) cropper.destroy();
            } else {
                alert("Upload failed: " + data.message);
            }
        } catch(err) {
            alert('Server error uploading image');
        } finally {
            saveCropBtn.disabled = false;
            saveCropBtn.innerText = "Crop & Upload";
        }
    }, 'image/jpeg', 0.8);
});

// Save Profile changes
saveProfileBtn.addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                profilePic: currentUser.profilePic,
                bio: profileBio.value
            })
        });

        const data = await res.json();
        if (res.ok) {
            currentUser = data; // replace with updated data
            localStorage.setItem('chatAppUser', JSON.stringify(currentUser));
            if(currentUser.profilePic) myProfilePic.src = currentUser.profilePic;
            
            // Close modal using bootstrap JS
            const myModalEl = document.getElementById('profileModal');
            const modal = bootstrap.Modal.getInstance(myModalEl);
            modal.hide();
        } else {
            alert(data.message);
        }
    } catch(err) {
        alert('Server error saving profile');
    }
});

// Emoji Picker Logic
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

const emojis = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"];

if (emojiBtn && emojiPicker) {
    // Populate
    emojiPicker.innerHTML = '<div class="d-flex flex-wrap gap-1">' + emojis.map(e => `<span class="emoji-item">${e}</span>`).join('') + '</div>';
    
    // Toggle
    emojiBtn.addEventListener('click', () => {
        emojiPicker.classList.toggle('d-none');
    });

    // Pick
    emojiPicker.addEventListener('click', (e) => {
        if (e.target.classList.contains('emoji-item')) {
            messageInput.value += e.target.innerText;
            messageInput.focus();
            emojiPicker.classList.add('d-none');
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
            emojiPicker.classList.add('d-none');
        }
    });
}

init();
