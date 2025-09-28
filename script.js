class VideoMeet {
    constructor() {
        this.localStream = null;
        this.remoteStreams = new Map();
        this.peerConnections = new Map();
        this.socket = null;
        this.meetingId = null;
        this.isScreenSharing = false;
        
        this.initializeSocket();
        this.setupEventListeners();
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('user-connected', (userId) => {
            this.createPeerConnection(userId, true);
        });

        this.socket.on('user-disconnected', (userId) => {
            this.removeRemoteVideo(userId);
        });

        this.socket.on('offer', async (data) => {
            await this.handleOffer(data);
        });

        this.socket.on('answer', async (data) => {
            await this.handleAnswer(data);
        });

        this.socket.on('ice-candidate', async (data) => {
            await this.handleIceCandidate(data);
        });

        this.socket.on('chat-message', (data) => {
            this.displayMessage(data.userId, data.message, false);
        });
    }

    setupEventListeners() {
        // Join/Create meeting buttons
        document.getElementById('joinBtn').addEventListener('click', () => this.showMeetingModal());
        document.getElementById('createBtn').addEventListener('click', () => this.createMeeting());
        document.getElementById('joinMeetingBtn').addEventListener('click', () => this.joinMeeting());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideMeetingModal());

        // Media controls
        document.getElementById('micBtn').addEventListener('click', () => this.toggleMic());
        document.getElementById('cameraBtn').addEventListener('click', () => this.toggleCamera());
        document.getElementById('screenShareBtn').addEventListener('click', () => this.toggleScreenShare());
        document.getElementById('hangupBtn').addEventListener('click', () => this.hangUp());

        // Chat
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    async createMeeting() {
        this.meetingId = Math.random().toString(36).substring(7);
        await this.initializeMedia();
        this.socket.emit('join-meeting', this.meetingId);
        this.showMeetingInfo();
    }

    async joinMeeting() {
        this.meetingId = document.getElementById('meetingIdInput').value;
        if (!this.meetingId) return;
        
        await this.initializeMedia();
        this.socket.emit('join-meeting', this.meetingId);
        this.hideMeetingModal();
        this.showMeetingInfo();
    }

    async initializeMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
        }
    }

    createPeerConnection(userId, isInitiator) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const peerConnection = new RTCPeerConnection(configuration);
        this.peerConnections.set(userId, peerConnection);

        // Add local stream to connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            const remoteStream = event.streams[0];
            this.remoteStreams.set(userId, remoteStream);
            this.addRemoteVideo(userId, remoteStream);
        };

        // ICE candidate handling
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', {
                    meetingId: this.meetingId,
                    target: userId,
                    candidate: event.candidate
                });
            }
        };

        if (isInitiator) {
            this.createOffer(userId);
        }

        return peerConnection;
    }

    async createOffer(userId) {
        const peerConnection = this.peerConnections.get(userId);
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.socket.emit('offer', {
                meetingId: this.meetingId,
                target: userId,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleOffer(data) {
        const peerConnection = this.createPeerConnection(data.from, false);
        
        try {
            await peerConnection.setRemoteDescription(data.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', {
                meetingId: this.meetingId,
                target: data.from,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(data) {
        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(data.answer);
        }
    }

    async handleIceCandidate(data) {
        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection) {
            await peerConnection.addIceCandidate(data.candidate);
        }
    }

    addRemoteVideo(userId, stream) {
        const remoteVideos = document.getElementById('remoteVideos');
        
        const videoContainer = document.createElement('div');
        videoContainer.className = 'remote-video';
        videoContainer.id = `remote-${userId}`;
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;
        
        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = `User ${userId.substring(0, 6)}`;
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(label);
        remoteVideos.appendChild(videoContainer);
    }

    removeRemoteVideo(userId) {
        const videoElement = document.getElementById(`remote-${userId}`);
        if (videoElement) {
            videoElement.remove();
        }
        this.remoteStreams.delete(userId);
        this.peerConnections.delete(userId);
    }

    toggleMic() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            const micBtn = document.getElementById('micBtn');
            micBtn.textContent = audioTrack.enabled ? '🎤' : '🔇';
        }
    }

    toggleCamera() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            const cameraBtn = document.getElementById('cameraBtn');
            cameraBtn.textContent = videoTrack.enabled ? '📹' : '📷';
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });
                
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = this.getVideoSender();
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
                
                this.isScreenSharing = true;
                document.getElementById('screenShareBtn').textContent = '🖥️';
                
                videoTrack.onended = () => {
                    this.stopScreenShare();
                };
                
            } else {
                this.stopScreenShare();
            }
        } catch (error) {
            console.error('Error sharing screen:', error);
        }
    }

    stopScreenShare() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            const sender = this.getVideoSender();
            if (sender && videoTrack) {
                sender.replaceTrack(videoTrack);
            }
            this.isScreenSharing = false;
            document.getElementById('screenShareBtn').textContent = '🖥️';
        }
    }

    getVideoSender() {
        for (const pc of this.peerConnections.values()) {
            const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            if (sender) return sender;
        }
        return null;
    }

    sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (message && this.meetingId) {
            this.socket.emit('chat-message', {
                meetingId: this.meetingId,
                message: message
            });
            
            this.displayMessage('You', message, true);
            input.value = '';
        }
    }

    displayMessage(user, message, isOwn) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''}`;
        messageDiv.textContent = `${user}: ${message}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hangUp() {
        // Close all peer connections
        this.peerConnections.forEach((pc, userId) => {
            pc.close();
            this.removeRemoteVideo(userId);
        });
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Leave meeting
        if (this.meetingId) {
            this.socket.emit('leave-meeting', this.meetingId);
        }
        
        // Reset UI
        document.getElementById('localVideo').srcObject = null;
        this.meetingId = null;
    }

    showMeetingModal() {
        document.getElementById('meetingModal').style.display = 'block';
    }

    hideMeetingModal() {
        document.getElementById('meetingModal').style.display = 'none';
    }

    showMeetingInfo() {
        alert(`Meeting ID: ${this.meetingId}\nShare this ID with others to join!`);
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new VideoMeet();
});
