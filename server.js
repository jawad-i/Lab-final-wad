const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load Environment Variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'skillswap_super_secret_jwt_key_2026';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Import Mongoose Models (with serverless safe compilation)
const User = require('./models/User');
const Skill = require('./models/Skill');
const Booking = require('./models/Booking');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ==========================================
// Database Connection with Serverless Caching
// ==========================================
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not defined. Please set it in your environment variables.');
  }

  mongoose.set('strictQuery', false);

  cachedDb = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });

  console.log('MongoDB connected successfully');
  return cachedDb;
}

// Ensure DB is connected for all API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    try {
      await connectToDatabase();
    } catch (err) {
      console.error('Database connection failed:', err.message);
      return res.status(500).json({
        message: 'Database connection failed. Please verify MONGO_URI in your environment.',
        error: err.message
      });
    }
  }
  next();
});

// ==========================================
// Multer In-Memory Storage for Serverless
// ==========================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 }, // 4.5MB limit to stay within Vercel serverless payload
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|mp4|webm|mkv|jpg|jpeg|png|gif|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);

    if (ext || mime) {
      return cb(null, true);
    }
    cb(new Error('Only PDF documents, video files, and image files are allowed!'));
  }
});

const skillUpload = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

const avatarUpload = upload.single('avatar');

// Helper to convert buffer to base64 Data URI
function bufferToDataURI(file) {
  if (!file || !file.buffer) return null;
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

// ==========================================
// Authentication Middleware
// ==========================================
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized access. Please login first.' });
  }

  try {
    let user = null;

    // Backward compatibility with legacy mock tokens
    if (token.startsWith('fake-jwt-token-')) {
      const userId = token.replace('fake-jwt-token-', '');
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).select('-password');
      }
    } else {
      // Standard JWT verification
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id || decoded._id;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).select('-password');
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found or session expired.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session. Please login again.' });
  }
};

// ==========================================
// Auth API Routes
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      credits: 10
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        credits: user.credits
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Support both bcrypt-hashed passwords and legacy plain text passwords
    let isMatch = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (user.password === password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        credits: user.credits
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Current User Validation (Used by index.html and other pages)
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// User Profile Routes
// ==========================================

// Get profile and own skills
app.get('/api/users/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const mySkills = await Skill.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ user, mySkills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update profile avatar
app.put('/api/users/profile', protect, (req, res) => {
  avatarUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      const updateData = {};
      if (req.file) {
        updateData.avatar = bufferToDataURI(req.file);
      }

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

// Delete user profile and all their skills
app.delete('/api/users/profile', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    await Skill.deleteMany({ user: userId });
    await Booking.deleteMany({ $or: [{ learner: userId }, { mentor: userId }] });
    await User.findByIdAndDelete(userId);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// Skills API Routes
// ==========================================

// Get all skills with search and category filters
app.get('/api/skills', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category && category !== 'All' && category !== '') {
      query.category = category;
    }

    if (search && search.trim() !== '') {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skills = await Skill.find(query)
      .populate('user', 'name avatar credits')
      .sort({ createdAt: -1 });

    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new skill offer
app.post('/api/skills', protect, (req, res) => {
  skillUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      const { title, category, description } = req.body;
      if (!title || !category || !description) {
        return res.status(400).json({ message: 'Title, category, and description are required' });
      }

      const pdfPath = req.files?.pdf ? bufferToDataURI(req.files.pdf[0]) : null;
      const videoPath = req.files?.video ? bufferToDataURI(req.files.video[0]) : null;

      const skill = await Skill.create({
        title,
        category,
        description,
        pdfFile: pdfPath,
        videoFile: videoPath,
        user: req.user._id
      });

      const populatedSkill = await Skill.findById(skill._id).populate('user', 'name avatar credits');
      res.status(201).json(populatedSkill);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
});

// Delete skill
app.delete('/api/skills/:id', protect, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });

    if (skill.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this skill' });
    }

    await Skill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Skill deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// Bookings API Routes (Time-Bank Logic)
// ==========================================

// Create booking session
app.post('/api/bookings', protect, async (req, res) => {
  try {
    const { skillId } = req.body;
    let { mentorId } = req.body;

    if (!skillId) {
      return res.status(400).json({ message: 'Skill ID is required' });
    }

    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    if (!mentorId) {
      mentorId = skill.user;
    }

    if (req.user._id.toString() === mentorId.toString()) {
      return res.status(400).json({ message: 'You cannot book your own skill session' });
    }

    const learner = await User.findById(req.user._id);
    if (learner.credits < 1) {
      return res.status(400).json({ message: 'Insufficient Skill Credits! You need at least 1 credit to book.' });
    }

    const booking = await Booking.create({
      skill: skillId,
      learner: req.user._id,
      mentor: mentorId
    });

    res.status(201).json({ message: 'Booking requested successfully!', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's bookings
app.get('/api/bookings/my-bookings', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [{ learner: req.user._id }, { mentor: req.user._id }]
    })
      .populate('skill')
      .populate('learner', 'name email avatar')
      .populate('mentor', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Complete booking session and transfer credit
app.patch('/api/bookings/:id/complete', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status === 'Completed') {
      return res.status(400).json({ message: 'Session is already completed' });
    }

    const learner = await User.findById(booking.learner);
    if (!learner || learner.credits < 1) {
      return res.status(400).json({ message: 'Learner has insufficient credits' });
    }

    await User.findByIdAndUpdate(booking.learner, { $inc: { credits: -1 } });
    await User.findByIdAndUpdate(booking.mentor, { $inc: { credits: 1 } });

    booking.status = 'Completed';
    await booking.save();

    res.json({ message: 'Session completed! 1 Skill Credit transferred.', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// Admin API Routes
// ==========================================

// Get all users
app.get('/api/admin/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin delete user
app.delete('/api/admin/users/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    await Skill.deleteMany({ user: req.params.id });
    await Booking.deleteMany({ $or: [{ learner: req.params.id }, { mentor: req.params.id }] });
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted by admin' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 404 Handler for Unmatched API Routes
// ==========================================
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// ==========================================
// Static HTML Page Serving (For Local Development)
// ==========================================
app.get('/:page', (req, res, next) => {
  const filePath = path.join(__dirname, 'public', `${req.params.page}.html`);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// Export for Vercel & Local Server Listener
// ==========================================
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;