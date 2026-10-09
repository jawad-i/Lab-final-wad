 const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const dns = require('dns');
const cors = require('cors');
const fs = require('fs');

// MongoDB Atlas DNS Issue Fix
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Static Path for Uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Ensure Uploads Directory Exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('Database Connection Error:', err.message));

// ==========================================
// Schemas & Models
// ==========================================

// User Model Schema (Updated with avatar field)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  role: { type: String, default: 'user' }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Skill Model Schema
const skillSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  pdfFile: { type: String, default: null },
  videoFile: { type: String, default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const Skill = mongoose.models.Skill || mongoose.model('Skill', skillSchema);

// ==========================================
// Multer Storage Setup
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Max 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|mp4|webm|mkv|jpg|jpeg|png/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);

    if (ext && mime) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, MP4/WEBM/MKV videos, and JPG/PNG image files are allowed!'));
  }
}).fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Auth Protect Middleware
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized access. Please login first.' });
  }

  try {
    const userId = token.replace('fake-jwt-token-', '');
    if (mongoose.Types.ObjectId.isValid(userId)) {
      req.user = await User.findById(userId).select('-password');
    }
    if (!req.user) {
      return res.status(401).json({ message: 'User not found or invalid token.' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token verification failed.' });
  }
};

// ==========================================
// Authentication Routes
// ==========================================

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      message: 'Registration successful',
      token: 'fake-jwt-token-' + user._id,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      token: 'fake-jwt-token-' + user._id,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// User Profile API Routes
// ==========================================

// Get User Profile & My Skills
app.get('/api/users/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const mySkills = await Skill.find({ user: req.user._id });

    res.json({ user, mySkills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Delete User Account
app.delete('/api/users/profile', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Delete all skills created by this user
    await Skill.deleteMany({ user: userId });

    // 2. Delete the user profile
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Profile Picture
const avatarUpload = multer({ storage: storage }).single('avatar');

app.put('/api/users/profile', protect, (req, res) => {
  avatarUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;
      const updateData = {};
      if (avatarPath) updateData.avatar = avatarPath;

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { new: true }
      ).select('-password');

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
});

// ==========================================
// Skill Routes
// ==========================================

// Post Skill Route
app.post('/api/skills', protect, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      const { title, category, description } = req.body;

      const pdfPath = req.files?.pdf ? `/uploads/${req.files.pdf[0].filename}` : null;
      const videoPath = req.files?.video ? `/uploads/${req.files.video[0].filename}` : null;

      const skill = await Skill.create({
        title,
        category,
        description,
        pdfFile: pdfPath,
        videoFile: videoPath,
        user: req.user._id
      });

      res.status(201).json(skill);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
});

// Get All Skills Route
app.get('/api/skills', async (req, res) => {
  try {
    const skills = await Skill.find().populate('user', 'name avatar');
    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Skill API Route
app.delete('/api/skills/:id', protect, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    // Check if the skill belongs to the logged-in user
    if (skill.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this skill' });
    }

    await Skill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Skill deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
module.exports = app;