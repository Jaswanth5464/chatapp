const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|mp4|webm|mp3|mpeg|wav/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype || extname) { // More flexible for audio blobs
            return cb(null, true);
        } else {
            cb(new Error('Images, Videos and Audio only!'));
        }
    }
});

// @route   POST /api/upload
// @desc    Upload an image/video
// @access  Private
router.post('/', protect, upload.single('media'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        // Return public URL relative path
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ url: fileUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
