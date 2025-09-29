// Complete Video Conferencing Application
class VideoConferenceApp {
    constructor() {
        this.peer = null;
        this.localStream = null;
        this.connections = new Map();
        this.meetingCode = '';
        this.userName = 'User';
        this.isHost = false;
        this.meetingStartTime = null;
        this.timerInterval = null;
        this.currentUser = null;
        this.participants = new Map();
        this.isScreenSharing = false;
        this.screenStream = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthState();
        this.initializeCameraPreview();
        this.setupResponsiveHandlers();
    }

    setupEventListeners() {
        // Auth events
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Meeting events
        document.getElementById('createMeetingBtn').addEventListener('click', () => this.createMeeting());
        document.getElementById('joinMeetingBtn').addEventListener('click', () => this.joinMeeting());
        document.getElementById('confirmUserName').addEventListener('click', () => this.confirmUserName());

        // Meeting controls
        document.getElementById('toggleMic').addEventListener('click', () => this.toggleAudio());
        document.getElementById('toggleCamera').addEventListener('click', () => this.toggleVideo());
        document.getElementById('shareScreen').addEventListener('click', () => this.toggleScreenShare());
        document.getElementById('leaveMeeting').addEventListener('click', () => this.leaveMeeting());

        // Panel controls
        document.getElementById('toggleChat').addEventListener('click', () => this.toggleChatPanel());
        document.getElementById('toggleParticipants').addEventListener('click', () => this.toggleParticipantsPanel());
        document.getElementById('closeChat').addEventListener('click', () => this.closeChatPanel());
        document.getElementById('closeParticipants').addEventListener('click', () => this.closeParticipantsPanel());

        // Chat
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Copy meeting code
        document.getElementById('copyMeetingCode').addEventListener('click', () => this.copyMeetingCode());

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => e.preventDefault());
        document.getElementById('registerForm').addEventListener('submit', (e) => e.preventDefault());
    }

    // Authentication Methods
    showRegisterForm() {
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('registerForm').classList.add('active');
    }

    showLoginForm() {
        document.getElementById('registerForm').classList.remove('active');
        document.getElementById('loginForm').classList.add('active');
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        try {
            this.showStatus('Signing in...', 'success');
            await this.simulateAPICall();
            
            const userData = {
                email: email,
                name: email.split('@')[0],
                isAuthenticated: true
            };
            localStorage.setItem('userData', JSON.stringify(userData));
            this.currentUser = userData;
            
            this.showStatus('Login successful!', 'success');
            setTimeout(() => {
                this.showPreMeetingScreen();
                this.updateUserGreeting(userData.name);
            }, 1000);
            
        } catch (error) {
            this.showStatus('Login failed. Please try again.', 'error');
        }
    }

    async handleRegister() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (!name || !email || !password || !confirmPassword) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showStatus('Passwords do not match', 'error');
            return;
        }

        try {
            this.showStatus('Creating account...', 'success');
            await this.simulateAPICall();
            
            const userData = {
                email: email,
                name: name,
                isAuthenticated: true
            };
            localStorage.setItem('userData', JSON.stringify(userData));
            this.currentUser = userData;
            
            this.showStatus('Account created successfully!', 'success');
            setTimeout(() => {
                this.showPreMeetingScreen();
                this.updateUserGreeting(name);
            }, 1000);
            
        } catch (error) {
            this.showStatus('Registration failed. Please try again.', 'error');
        }
    }

    handleLogout() {
        localStorage.removeItem('userData');
        this.currentUser = null;
        this.showAuthScreen();
        this.showStatus('Logged out successfully', 'success');
    }

    checkAuthState() {
        const userData = localStorage.getItem('userData');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                if (user.isAuthenticated) {
                    this.currentUser = user;
                    this.showPreMeetingScreen();
                    this.updateUserGreeting(user.name);
                    return;
                }
            } catch (error) {
                localStorage.removeItem('userData');
            }
        }
        this.showAuthScreen();
    }

    updateUserGreeting(name) {
        const greetingElement = document.getElementById('userGreeting');
        if (greetingElement) {
            greetingElement.textContent = `Welcome, ${name}`;
        }
        this.userName = name;
    }

    // Screen Management
    showAuthScreen() {
        this.hideAllScreens();
        document.getElementById('authScreen').classList.add('active');
        document.body.style.overflow = 'auto';
        this.showLoginForm();
    }

    showPreMeetingScreen() {
        this.hideAllScreens();
        document.getElementById('preMeetingScreen').classList.add('active');
        document.body.style.overflow = 'auto';
        this.handleResize();
    }

    showMeetingScreen() {
        this.hideAllScreens();
        document.getElementById('meetingScreen').classList.add('active');
        document.body.style.overflow = 'hidden';
        this.startMeetingTimer();
        this.handleResize();
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }

    // Meeting Methods
    async createMeeting() {
        try {
            await this.initializeLocalStream();
            this.meetingCode = this.generateMeetingCode();
            this.isHost = true;
            this.showUserNameModal('Create Meeting');
        } catch (error) {
            this.showStatus('Failed to create meeting. Please check camera permissions.', 'error');
        }
    }

    async joinMeeting() {
        const meetingCode = document.getElementById('meetingCodeInput').value.trim();
        
        if (!meetingCode) {
            this.showStatus('Please enter a meeting code', 'error');
            return;
        }

        try {
            await this.initializeLocalStream();
            this.meetingCode = meetingCode.toUpperCase();
            this.isHost = false;
            this.showUserNameModal('Join Meeting');
        } catch (error) {
            this.showStatus('Failed to join meeting. Please check camera permissions.', 'error');
        }
    }

    showUserNameModal(action) {
        const modal = document.getElementById('userNameModal');
        const userNameInput = document.getElementById('userNameInput');
        
        if (this.currentUser) {
            userNameInput.value = this.currentUser.name;
        }
        
        modal.classList.add('active');
        userNameInput.focus();
    }

    confirmUserName() {
        const userNameInput = document.getElementById('userNameInput');
        const name = userNameInput.value.trim();
        
        if (!name) {
            this.showStatus('Please enter your name', 'error');
            return;
        }

        this.userName = name;
        document.getElementById('userNameModal').classList.remove('active');
        this.startMeeting();
    }

    async startMeeting() {
        try {
            this.showMeetingScreen();
            this.initializePeerConnection();
            
            document.getElementById('meetingCodeDisplay').textContent = this.meetingCode;
            this.addVideoStream('local', this.localStream, this.userName);
            
            if (this.isHost) {
                this.showStatus('Meeting created successfully! Share the code with others.', 'success');
                this.addSystemMessage('You started the meeting. Share the meeting code with others!');
            } else {
                this.showStatus('Joined meeting successfully!', 'success');
                this.addSystemMessage(`${this.userName} joined the meeting`);
            }
            
            this.updateParticipantsList();
            
        } catch (error) {
            this.showStatus('Failed to start meeting', 'error');
        }
    }

    async initializeLocalStream() {
        try {
            const constraints = {
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const preview = document.getElementById('cameraPreview');
            const previewVideo = document.getElementById('previewVideo');
            if (preview && previewVideo) {
                preview.classList.add('active');
                previewVideo.srcObject = this.localStream;
            }
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    initializeCameraPreview() {
        // Camera preview will be shown when user interacts
    }

    initializePeerConnection() {
        console.log('Peer connection initialized for meeting:', this.meetingCode);
        // In real implementation, this would setup WebRTC connections
    }

    addVideoStream(id, stream, name) {
        const videosContainer = document.getElementById('videosContainer');
        if (!videosContainer) return;
        
        // Remove existing video if it exists
        const existingVideo = document.getElementById(`video-${id}`);
        if (existingVideo) {
            existingVideo.remove();
        }
        
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.id = `video-${id}`;
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = id === 'local';
        
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.innerHTML = `
            <span class="participant-name">${name}${id === 'local' ? ' (You)' : ''}</span>
            <div class="participant-status">
                <span class="mic-status">🎤</span>
                <span class="video-status">📹</span>
            </div>
        `;
        
        videoWrapper.appendChild(video);
        videoWrapper.appendChild(overlay);
        videosContainer.appendChild(videoWrapper);
        
        this.adjustVideoLayout();
    }

    // Meeting Controls
    toggleAudio() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const enabled = !audioTracks[0].enabled;
                audioTracks.forEach(track => track.enabled = enabled);
                
                const toggleMicBtn = document.getElementById('toggleMic');
                toggleMicBtn.classList.toggle('active', enabled);
                toggleMicBtn.querySelector('.label').textContent = enabled ? 'Mute' : 'Unmute';
                
                this.showStatus(enabled ? 'Microphone unmuted' : 'Microphone muted', 'success');
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                const enabled = !videoTracks[0].enabled;
                videoTracks.forEach(track => track.enabled = enabled);
                
                const toggleCameraBtn = document.getElementById('toggleCamera');
                toggleCameraBtn.classList.toggle('active', enabled);
                toggleCameraBtn.querySelector('.label').textContent = enabled ? 'Stop Video' : 'Start Video';
                
                this.showStatus(enabled ? 'Video started' : 'Video stopped', 'success');
            }
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                
                this.isScreenSharing = true;
                const shareScreenBtn = document.getElementById('shareScreen');
                shareScreenBtn.classList.add('active');
                shareScreenBtn.querySelector('.label').textContent = 'Stop Share';
                
                // Replace video stream
                this.addVideoStream('local', this.screenStream, `${this.userName} (Screen)`);
                
                this.showStatus('Screen sharing started', 'success');
                
                this.screenStream.getVideoTracks()[0].onended = () => {
                    this.stopScreenShare();
                };
                
            } else {
                this.stopScreenShare();
            }
        } catch (error) {
            if (error.name !== 'NotAllowedError') {
                this.showStatus('Screen sharing failed', 'error');
            }
        }
    }

    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        this.isScreenSharing = false;
        const shareScreenBtn = document.getElementById('shareScreen');
        shareScreenBtn.classList.remove('active');
        shareScreenBtn.querySelector('.label').textContent = 'Share Screen';
        
        // Restore camera stream
        this.addVideoStream('local', this.localStream, this.userName);
        this.showStatus('Screen sharing stopped', 'success');
    }

    leaveMeeting() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
        }
        
        // Clear timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Reset state
        this.meetingCode = '';
        this.isHost = false;
        this.connections.clear();
        this.participants.clear();
        
        // Clear UI
        const videosContainer = document.getElementById('videosContainer');
        if (videosContainer) videosContainer.innerHTML = '';
        
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="system-message">Meeting started. Share the meeting code with others!</div>';
        }
        
        // Show pre-meeting screen
        this.showPreMeetingScreen();
        this.showStatus('Left meeting successfully', 'success');
    }

    // Panel Controls
    toggleChatPanel() {
        const chatPanel = document.getElementById('chatPanel');
        const participantsPanel = document.getElementById('participantsPanel');
        
        participantsPanel.classList.add('hidden');
        chatPanel.classList.toggle('hidden');
    }

    toggleParticipantsPanel() {
        const chatPanel = document.getElementById('chatPanel');
        const participantsPanel = document.getElementById('participantsPanel');
        
        chatPanel.classList.add('hidden');
        participantsPanel.classList.toggle('hidden');
    }

    closeChatPanel() {
        document.getElementById('chatPanel').classList.add('hidden');
    }

    closeParticipantsPanel() {
        document.getElementById('participantsPanel').classList.add('hidden');
    }

    closeAllPanels() {
        this.closeChatPanel();
        this.closeParticipantsPanel();
    }

    // Chat Methods
    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        this.addChatMessage(this.userName, message, true);
        messageInput.value = '';
    }

    addChatMessage(sender, message, isOwn = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;
        
        messageDiv.innerHTML = `
            <div class="message-sender">${isOwn ? 'You' : sender}</div>
            <div class="message-content">${this.escapeHtml(message)}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    addSystemMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const systemDiv = document.createElement('div');
        systemDiv.className = 'system-message';
        systemDiv.textContent = message;
        
        chatMessages.appendChild(systemDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Utility Methods
    generateMeetingCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    copyMeetingCode() {
        navigator.clipboard.writeText(this.meetingCode).then(() => {
            this.showStatus('Meeting code copied to clipboard!', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy meeting code', 'error');
        });
    }

    startMeetingTimer() {
        this.meetingStartTime = new Date();
        this.timerInterval = setInterval(() => {
            this.updateMeetingTimer();
        }, 1000);
    }

    updateMeetingTimer() {
        if (!this.meetingStartTime) return;
        
        const now = new Date();
        const diff = now - this.meetingStartTime;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        const timer = document.getElementById('meetingTimer');
        if (timer) {
            timer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    updateParticipantsList() {
        const participantsList = document.getElementById('participantsList');
        const participantCount = document.getElementById('participantCount');
        
        if (participantsList && participantCount) {
            participantsList.innerHTML = `
                <div class="participant-item">
                    <span class="participant-name">${this.userName} (You) ${this.isHost ? '(Host)' : ''}</span>
                    <span class="participant-status">🟢 Connected</span>
                </div>
            `;
            
            participantCount.textContent = '1 participant';
        }
    }

    

    showStatus(message, type = 'success') {
        const statusEl = document.getElementById('statusMessage');
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 4000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    simulateAPICall() {
        return new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }

    // Responsive handling
    setupResponsiveHandlers() {
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
    }

    handleResize() {
        this.adjustVideoLayout();
        this.adjustPanelLayout();
    }

    adjustVideoLayout() {
        const videosContainer = document.getElementById('videosContainer');
        if (!videosContainer) return;

        const videoWrappers = videosContainer.querySelectorAll('.video-wrapper');
        const videoCount = videoWrappers.length;
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            videosContainer.style.gridTemplateColumns = '1fr';
        } else {
            if (videoCount === 1) {
                videosContainer.style.gridTemplateColumns = '1fr';
            } else if (videoCount === 2) {
                videosContainer.style.gridTemplateColumns = '1fr 1fr';
            } else {
                videosContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
            }
        }
    }

    adjustPanelLayout() {
        const isMobile = window.innerWidth <= 768;
        const sidePanels = document.querySelectorAll('.side-panel');

        sidePanels.forEach(panel => {
            if (isMobile && !panel.classList.contains('hidden')) {
                panel.style.width = '100%';
            }
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new VideoConferenceApp();
});