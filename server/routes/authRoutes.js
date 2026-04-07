const express = require('express');
const { register, login, getAllUsers, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', protect, getAllUsers);
router.put('/profile', protect, updateProfile);

module.exports = router;
