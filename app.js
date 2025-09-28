// Global variables
let localStream = null;
let localVideo = null;
let peer = null;
let currentPeerId = null;
let meetingCode = "";
let isHost = false;
let localUserName = "User";
let connections = new Map();
let dataConnections = new Map();
let participants = new Map();
let activePanel = null;

// DOM Elements
const preMeetingScreen = document.getElementById('preMeetingScreen');
const meetingScreen = document.getElementById('meetingScreen');
const meetingCodeInput = document.getElementById('meetingCodeInput');
const joinMeetingBtn = document.getElementById('joinMeetingBtn');
const createMeetingBtn = document.getElementById('createMeetingBtn');
const meetingCodeDisplay = document.getElementById('meetingCodeDisplay');
const copyMeetingCodeBtn = document.getElementById('copyMeetingCode');
const videosContainer = document.getElementById('videosContainer');
const chatMessagesDiv = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const participantsList = document.getElementById('participantsList');
const participantCount = document.getElementById('participantCount');
const toggleMicBtn = document.getElementById('toggleMic');
const toggleCameraBtn = document.getElementById('toggleCamera');
const shareScreenBtn = document.getElementById('shareScreen');
const userNameModal = document.getElementById('userNameModal');
const userNameInput = document.getElementById('userNameInput');
const confirmUserNameBtn = document.getElementById('confirmUserName');
const statusMessage = document.getElementById('statusMessage');
const cameraPreview = document.getElementById('cameraPreview');
const previewVideo = document.getElementById('previewVideo');

// Initialize app
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupEventListeners();
    initializeCameraPreview();
    createParticles();
}

function setupEventListeners() {
    joinMeetingBtn.addEventListener('click', handleJoinMeeting);
    createMeetingBtn.addEventListener('click', handleCreateMeeting);
    copyMeetingCodeBtn.addEventListener('click', copyMeetingCode);
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
    toggleMicBtn.addEventListener('click', toggleMic);
    toggleCameraBtn.addEventListener('click', toggleCamera);
    shareScreenBtn.addEventListener('click', toggleScreenShare);
    confirmUserNameBtn.addEventListener('click', confirmUserName);
    document.getElementById('leaveMeeting').addEventListener('click', leaveMeeting);
    
    // Fixed panel toggle listeners
    document.getElementById('toggleChat').addEventListener('click', () => togglePanel('chat'));
    document.getElementById('toggleParticipants').addEventListener('click', () => togglePanel('participants'));
    document.getElementById('closeChat').addEventListener('click', () => togglePanel('chat'));
    document.getElementById('closeParticipants').addEventListener('click', () => togglePanel('participants'));
}

// FIXED PANEL TOGGLE FUNCTION
function togglePanel(panel) {
    const chatPanel = document.getElementById('chatPanel');
    const participantsPanel = document.getElementById('participantsPanel');
    const toggleChatBtn = document.getElementById('toggleChat');
    const toggleParticipantsBtn = document.getElementById('toggleParticipants');

    // If clicking the same panel button, close it
    if (activePanel === panel) {
        closeAllPanels();
        activePanel = null;
        return;
    }

    // Close all panels first
    closeAllPanels();

    // Open the requested panel
    if (panel === 'chat') {
        chatPanel.classList.remove('hidden');
        toggleChatBtn.classList.add('active');
        activePanel = 'chat';
        setTimeout(() => messageInput.focus(), 100);
    } else if (panel === 'participants') {
        participantsPanel.classList.remove('hidden');
        toggleParticipantsBtn.classList.add('active');
        activePanel = 'participants';
    }
}

function closeAllPanels() {
    const chatPanel = document.getElementById('chatPanel');
    const participantsPanel = document.getElementById('participantsPanel');
    const toggleChatBtn = document.getElementById('toggleChat');
    const toggleParticipantsBtn = document.getElementById('toggleParticipants');

    chatPanel.classList.add('hidden');
    participantsPanel.classList.add('hidden');
    toggleChatBtn.classList.remove('active');
    toggleParticipantsBtn.classList.remove('active');
}

async function initializeCameraPreview() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 },
            audio: true 
        });
        previewVideo.srcObject = stream;
        cameraPreview.classList.add('active');
        localStream = stream;
        showStatus('Camera ready!', 'success');
    } catch (error) {
        console.warn('Camera preview failed:', error);
        showStatus('Camera access required for video calls', 'warning');
    }
}

function generateMeetingCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function handleCreateMeeting() {
    meetingCode = generateMeetingCode();
    isHost = true;
    showUserNameModal();
}

function handleJoinMeeting() {
    const code = meetingCodeInput.value.trim().toUpperCase();
    if (code.length < 4) {
        showStatus('Please enter a valid meeting code', 'error');
        return;
    }
    meetingCode = code;
    isHost = false;
    showUserNameModal();
}

function showUserNameModal() {
    userNameModal.classList.add('active');
    userNameInput.focus();
}

function confirmUserName() {
    const name = userNameInput.value.trim() || "User";
    localUserName = name;
    userNameModal.classList.remove('active');
    joinMeeting();
}

async function joinMeeting() {
    try {
        showStatus('Joining meeting...', 'success');
        
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
        }
        
        await initializePeerConnection();
        setupMeetingUI();
        createLocalVideoElement();
        
        if (isHost) {
            showStatus(`Meeting created! Share code: ${meetingCode}`, 'success');
        } else {
            connectToHost();
        }
        
    } catch (error) {
        console.error('Error joining meeting:', error);
        showStatus('Failed to join meeting: ' + error.message, 'error');
    }
}

function initializePeerConnection() {
    return new Promise((resolve, reject) => {
        currentPeerId = isHost ? meetingCode : `participant-${Math.random().toString(36).substr(2, 8)}`;
        
        peer = new Peer(currentPeerId, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        peer.on('open', (id) => {
            addParticipant(id, localUserName, isHost);
            resolve();
        });
        
        peer.on('call', (call) => {
            call.answer(localStream);
            call.on('stream', (remoteStream) => {
                addRemoteVideo(call.peer, remoteStream);
            });
            connections.set(call.peer, call);
        });
        
        peer.on('connection', (conn) => {
            conn.on('data', (data) => {
                handleDataMessage(conn.peer, data);
            });
            dataConnections.set(conn.peer, conn);
        });
        
        peer.on('error', (error) => {
            showStatus('Connection error: ' + error.message, 'error');
            reject(error);
        });
    });
}

function connectToHost() {
    const dataConn = peer.connect(meetingCode);
    
    dataConn.on('open', () => {
        dataConnections.set(meetingCode, dataConn);
        dataConn.send({
            type: 'join',
            userName: localUserName,
            peerId: currentPeerId,
            isHost: false
        });
        
        setTimeout(() => {
            const call = peer.call(meetingCode, localStream);
            call.on('stream', (remoteStream) => {
                addRemoteVideo(meetingCode, remoteStream);
                addParticipant(meetingCode, 'Host', true);
            });
            connections.set(meetingCode, call);
        }, 1000);
    });
    
    dataConn.on('data', (data) => {
        handleDataMessage(meetingCode, data);
    });
}

function handleDataMessage(fromPeer, data) {
    switch(data.type) {
        case 'join':
            if (isHost) {
                addParticipant(data.peerId, data.userName, false);
                broadcastToParticipants({
                    type: 'user-joined',
                    userName: data.userName,
                    peerId: data.peerId
                }, [fromPeer]);
                addSystemMessage(`${data.userName} joined the meeting`);
                setTimeout(() => {
                    const call = peer.call(data.peerId, localStream);
                    call.on('stream', (remoteStream) => {
                        addRemoteVideo(data.peerId, remoteStream);
                    });
                    connections.set(data.peerId, call);
                }, 500);
            }
            break;
            
        case 'chat':
            addChatMessage(data.userName, data.message, data.fromPeerId === currentPeerId);
            break;
            
        case 'user-joined':
            if (data.peerId !== currentPeerId) {
                addParticipant(data.peerId, data.userName, false);
                addSystemMessage(`${data.userName} joined the meeting`);
            }
            break;
            
        case 'user-left':
            removeParticipant(data.peerId);
            addSystemMessage(`${data.userName} left the meeting`);
            break;
    }
}

function broadcastToParticipants(message, excludePeers = []) {
    dataConnections.forEach((conn, peerId) => {
        if (!excludePeers.includes(peerId) && conn.open) {
            conn.send(message);
        }
    });
}

function setupMeetingUI() {
    preMeetingScreen.classList.remove('active');
    meetingScreen.classList.add('active');
    meetingCodeDisplay.textContent = `Meeting: ${meetingCode}`;
    window.history.pushState({}, '', `?code=${meetingCode}`);
    closeAllPanels();
}

function createLocalVideoElement() {
    localVideo = document.createElement('video');
    localVideo.id = 'localVideo';
    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.playsInline = true;
    localVideo.srcObject = localStream;
    
    const videoWrapper = createVideoWrapper(localUserName + ' (You)', localVideo, true);
    videoWrapper.id = 'video-local';
    videosContainer.appendChild(videoWrapper);
}

function createVideoWrapper(userName, videoElement, isLocal = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    
    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = userName;
    
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    
    if (isLocal) {
        const micIcon = document.createElement('span');
        micIcon.className = 'status-icon';
        micIcon.textContent = '🎤';
        const videoIcon = document.createElement('span');
        videoIcon.className = 'status-icon';
        videoIcon.textContent = '📹';
        controls.appendChild(micIcon);
        controls.appendChild(videoIcon);
    }
    
    overlay.appendChild(nameSpan);
    overlay.appendChild(controls);
    wrapper.appendChild(videoElement);
    wrapper.appendChild(overlay);
    
    return wrapper;
}

function addRemoteVideo(peerId, stream) {
    const existingVideo = document.getElementById(`video-${peerId}`);
    if (existingVideo) existingVideo.remove();
    
    const video = document.createElement('video');
    video.id = `video-${peerId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    
    const participant = participants.get(peerId);
    const userName = participant ? participant.userName : 'Remote User';
    
    const videoWrapper = createVideoWrapper(userName, video);
    videoWrapper.id = `video-${peerId}`;
    videosContainer.appendChild(videoWrapper);
}

function addParticipant(peerId, userName, isHost) {
    participants.set(peerId, { userName, isHost });
    updateParticipantsDisplay();
}

function removeParticipant(peerId) {
    participants.delete(peerId);
    const videoElement = document.getElementById(`video-${peerId}`);
    if (videoElement) videoElement.remove();
    if (connections.has(peerId)) connections.get(peerId).close();
    if (dataConnections.has(peerId)) dataConnections.delete(peerId);
    updateParticipantsDisplay();
}

function updateParticipantsDisplay() {
    participantsList.innerHTML = '';
    participantCount.textContent = `${participants.size} participant${participants.size !== 1 ? 's' : ''}`;
    
    participants.forEach((participant, peerId) => {
        const participantDiv = document.createElement('div');
        participantDiv.className = `participant ${participant.isHost ? 'host' : ''}`;
        participantDiv.innerHTML = `
            <span class="icon">${participant.isHost ? '👑' : '👤'}</span>
            <span class="name">${participant.userName} ${peerId === currentPeerId ? '(You)' : ''}</span>
            <span class="status">Online</span>
        `;
        participantsList.appendChild(participantDiv);
    });
}

function addChatMessage(sender, text, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    
    const time = new Date();
    messageDiv.innerHTML = `
        <div class="sender">${sender}${isOwn ? ' (You)' : ''}</div>
        <div class="text">${text}</div>
        <div class="time">${time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    
    chatMessagesDiv.appendChild(messageDiv);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    chatMessagesDiv.appendChild(messageDiv);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    
    const messageData = {
        type: 'chat',
        userName: localUserName,
        message: text,
        fromPeerId: currentPeerId
    };
    
    if (isHost) {
        broadcastToParticipants(messageData);
        addChatMessage(localUserName, text, true);
    } else {
        const hostConn = dataConnections.get(meetingCode);
        if (hostConn) {
            hostConn.send(messageData);
            addChatMessage(localUserName, text, true);
        }
    }
    
    messageInput.value = '';
}

function copyMeetingCode() {
    navigator.clipboard.writeText(meetingCode).then(() => {
        copyMeetingCodeBtn.textContent = 'Copied!';
        setTimeout(() => copyMeetingCodeBtn.textContent = 'Copy', 2000);
    });
}

function toggleMic() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const enabled = !audioTracks[0].enabled;
            audioTracks[0].enabled = enabled;
            toggleMicBtn.classList.toggle('active', enabled);
            toggleMicBtn.querySelector('.label').textContent = enabled ? 'Mute' : 'Unmute';
        }
    }
}

function toggleCamera() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const enabled = !videoTracks[0].enabled;
            videoTracks[0].enabled = enabled;
            toggleCameraBtn.classList.toggle('active', enabled);
            toggleCameraBtn.querySelector('.label').textContent = enabled ? 'Stop Video' : 'Start Video';
        }
    }
}

async function toggleScreenShare() {
    try {
        if (!isScreenSharing) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            const videoTrack = screenStream.getVideoTracks()[0];
            connections.forEach(call => {
                if (call.peerConnection) {
                    const sender = call.peerConnection.getSenders()
                        .find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                }
            });
            
            localVideo.srcObject = screenStream;
            isScreenSharing = true;
            shareScreenBtn.classList.add('active');
            shareScreenBtn.querySelector('.label').textContent = 'Stop Share';
            
            videoTrack.onended = () => toggleScreenShare();
            
        } else {
            const videoTrack = localStream.getVideoTracks()[0];
            connections.forEach(call => {
                if (call.peerConnection) {
                    const sender = call.peerConnection.getSenders()
                        .find(s => s.track && s.track.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                }
            });
            
            localVideo.srcObject = localStream;
            screenStream.getTracks().forEach(track => track.stop());
            isScreenSharing = false;
            shareScreenBtn.classList.remove('active');
            shareScreenBtn.querySelector('.label').textContent = 'Share Screen';
        }
    } catch (error) {
        console.error('Screen share error:', error);
    }
}

function leaveMeeting() {
    const leaveData = {
        type: 'user-left',
        userName: localUserName,
        peerId: currentPeerId
    };
    
    if (isHost) {
        broadcastToParticipants(leaveData);
    } else {
        const hostConn = dataConnections.get(meetingCode);
        if (hostConn) hostConn.send(leaveData);
    }
    
    connections.forEach(conn => conn.close());
    dataConnections.forEach(conn => conn.close());
    
    if (peer) peer.destroy();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    
    meetingScreen.classList.remove('active');
    preMeetingScreen.classList.add('active');
    
    connections.clear();
    dataConnections.clear();
    participants.clear();
    videosContainer.innerHTML = '';
    chatMessagesDiv.innerHTML = '<div class="system-message">Meeting started. Share the meeting code with others!</div>';
    closeAllPanels();
    
    showStatus('Left the meeting', 'success');
}

function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message';
    if (type === 'error') statusMessage.classList.add('error');
    if (type === 'warning') statusMessage.classList.add('warning');
    statusMessage.style.display = 'block';
    
    setTimeout(() => statusMessage.style.display = 'none', 4000);
}

function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles';
    document.body.appendChild(particlesContainer);
}