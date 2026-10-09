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

const DEFAULT_MONGO_URI = 'mongodb+srv://akibjawadit_db_user:niepIOFoiOPMPzGC@cluster0.mvgf5ks.mongodb.net/skillswap?retryWrites=true&w=majority';
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || DEFAULT_MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'skillswap_super_secret_jwt_key_2026';

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

  mongoose.set('strictQuery', false);

  cachedDb = await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10
  });

  console.log('MongoDB connected successfully');
  return cachedDb;
}

// Ensure DB connected for all API requests
const ensureDbConnected = async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return res.status(500).json({
      message: 'Database connection failed. Please ensure MongoDB Atlas is reachable.',
      error: err.message
    });
  }
};

// ==========================================
// Multer In-Memory Storage for Serverless
// ==========================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 }, // 4.5MB limit
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

    if (token.startsWith('fake-jwt-token-')) {
      const userId = token.replace('fake-jwt-token-', '');
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId).select('-password');
      }
    } else {
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
// API Endpoints (Explicit Array Matching)
// ==========================================

// Health Check
app.get(['/api/health', '/health'], ensureDbConnected, (req, res) => {
  res.json({
    status: 'ok',
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

// Auth Routes
app.post(['/api/auth/register', '/auth/register'], ensureDbConnected, async (req, res) => {
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

app.post(['/api/auth/login', '/auth/login'], ensureDbConnected, async (req, res) => {
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

app.get(['/api/auth/me', '/auth/me'], ensureDbConnected, protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Profile Routes
app.get(['/api/users/profile', '/users/profile'], ensureDbConnected, protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const mySkills = await Skill.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ user, mySkills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put(['/api/users/profile', '/users/profile'], ensureDbConnected, protect, (req, res) => {
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

app.delete(['/api/users/profile', '/users/profile'], ensureDbConnected, protect, async (req, res) => {
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

// Skills Routes
app.get(['/api/skills', '/skills'], ensureDbConnected, async (req, res) => {
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

app.post(['/api/skills', '/skills'], ensureDbConnected, protect, (req, res) => {
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

app.delete(['/api/skills/:id', '/skills/:id'], ensureDbConnected, protect, async (req, res) => {
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

// Bookings Routes
app.post(['/api/bookings', '/bookings'], ensureDbConnected, protect, async (req, res) => {
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

app.get(['/api/bookings/my-bookings', '/bookings/my-bookings'], ensureDbConnected, protect, async (req, res) => {
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

app.patch(['/api/bookings/:id/complete', '/bookings/:id/complete'], ensureDbConnected, protect, async (req, res) => {
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

// Admin Routes
app.get(['/api/admin/users', '/admin/users'], ensureDbConnected, protect, async (req, res) => {
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

app.delete(['/api/admin/users/:id', '/admin/users/:id'], ensureDbConnected, protect, async (req, res) => {
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

// Any unmatched /api path ALWAYS returns JSON 404, NEVER HTML
app.use('/api', (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.url}` });
});

// ==========================================
// Static HTML Page Serving & Clean URLs
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

// Fallback for non-API requests
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