const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const compression = require('compression');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const { initSocket } = require('./sockets/socket');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Route imports
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
app.use(compression());
const server = http.createServer(app);

// Middleware
app.use(cors()); // Allow all cross-origin requests for now (CORS fix)
app.use(express.json()); // Parse JSON bodies

// Debug logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize Socket.io with the HTTP server
initSocket(server);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);

// Static files for frontend (Served from Root)
app.use(express.static(path.join(process.cwd(), 'client')));

// Catch-all to serve index.html for any frontend routing (MUST be below API routes)
app.get('*', (req, res) => {
    const indexPath = path.join(process.cwd(), 'client', 'index.html');
    res.sendFile(indexPath);
});

// Root Endpoint for deployment health check
app.get('/', (req, res) => {
    res.send('Smart Chat API is running...');
});

// Database Connection & Server Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-chat';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
    });
