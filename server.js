const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

let rooms = {}; // Store active rooms with { users: [], password: '' }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', (data) => {
    const { roomId, password } = data;
    
    // Check if room already exists
    if (rooms[roomId]) {
      socket.emit('room-error', { message: 'Room already exists' });
      return;
    }
    
    // Create new room
    rooms[roomId] = {
      users: [socket.id],
      password: password
    };
    
    socket.join(roomId);
    socket.emit('room-joined', roomId);
    console.log('Room created:', roomId);
  });

  socket.on('join-room', (data) => {
    const { roomId, password } = data;
    
    if (!rooms[roomId]) {
      socket.emit('room-error', { message: 'Room does not exist' });
      return;
    }
    
    // Check password
    if (rooms[roomId].password !== password) {
      socket.emit('room-error', { message: 'Invalid password' });
      return;
    }
    
    // Check room capacity
    if (rooms[roomId].users.length >= 2) {
      socket.emit('room-full-error');
      return;
    }
    
    rooms[roomId].users.push(socket.id);
    socket.join(roomId);
    socket.emit('room-joined', roomId);
    
    // Notify both users that room is full
    if (rooms[roomId].users.length === 2) {
      io.to(roomId).emit('room-full');
    }
    
    console.log('User joined room:', roomId);
  });

  socket.on('send-message', (data) => {
    socket.to(data.roomId).emit('receive-message', data);
  });

  socket.on('leave-room', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(id => id !== socket.id);
      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from rooms
    for (let room in rooms) {
      rooms[room].users = rooms[room].users.filter(id => id !== socket.id);
      if (rooms[room].users.length === 0) {
        delete rooms[room];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});