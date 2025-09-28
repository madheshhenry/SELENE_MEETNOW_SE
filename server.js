const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store active meetings
const meetings = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-meeting', (meetingId) => {
        // Leave any previous meeting
        if (socket.meetingId) {
            socket.leave(socket.meetingId);
        }

        socket.meetingId = meetingId;
        socket.join(meetingId);

        // Initialize meeting if it doesn't exist
        if (!meetings.has(meetingId)) {
            meetings.set(meetingId, new Set());
        }
        meetings.get(meetingId).add(socket.id);

        // Notify other users in the meeting
        socket.to(meetingId).emit('user-connected', socket.id);

        console.log(`User ${socket.id} joined meeting ${meetingId}`);
    });

    socket.on('offer', (data) => {
        socket.to(data.target).emit('offer', {
            offer: data.offer,
            from: socket.id
        });
    });

    socket.on('answer', (data) => {
        socket.to(data.target).emit('answer', {
            answer: data.answer,
            from: socket.id
        });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', {
            candidate: data.candidate,
            from: socket.id
        });
    });

    socket.on('chat-message', (data) => {
        socket.to(data.meetingId).emit('chat-message', {
            message: data.message,
            userId: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.meetingId) {
            const meeting = meetings.get(socket.meetingId);
            if (meeting) {
                meeting.delete(socket.id);
                if (meeting.size === 0) {
                    meetings.delete(socket.meetingId);
                }
            }
            
            socket.to(socket.meetingId).emit('user-disconnected', socket.id);
        }
    });

    socket.on('leave-meeting', (meetingId) => {
        socket.leave(meetingId);
        socket.to(meetingId).emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
