const express = require('express');
const { 
    accessChat, 
    fetchChats, 
    allMessages, 
    suggestReply, 
    getUserAnalytics,
    createGroupChat,
    renameGroup,
    addToGroup,
    removeFromGroup,
    deleteMessage,
    editMessage
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, accessChat);
router.get('/', protect, fetchChats);
router.get('/:chatId', protect, allMessages);
router.post('/suggest', protect, suggestReply);
router.get('/analytics/data', protect, getUserAnalytics);

// Group Chat Routes
router.post('/group', protect, createGroupChat);
router.put('/rename', protect, renameGroup);
router.put('/groupadd', protect, addToGroup);
router.put('/groupremove', protect, removeFromGroup);

// Message Management
router.delete('/message/:messageId', protect, deleteMessage);
router.put('/message/:messageId', protect, editMessage);

module.exports = router;
