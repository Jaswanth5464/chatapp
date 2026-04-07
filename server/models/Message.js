const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    content: {
        type: String,
        trim: true
    },
    mediaUrl: {
        type: String,
        default: ""
    },
    mediaType: {
        type: String, // 'image', 'video', etc.
        default: ""
    },
    isCallLog: {
        type: Boolean,
        default: false
    },
    callDuration: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent'
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
