const express = require('express');
const { accessChat, fetchChats, allMessages, suggestReply, getUserAnalytics } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, accessChat);
router.get('/', protect, fetchChats);
router.get('/:chatId', protect, allMessages);
router.post('/suggest', protect, suggestReply);
router.get('/analytics/data', protect, getUserAnalytics);

module.exports = router;
