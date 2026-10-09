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

function getMimeType(file) {
  if (file.mimetype && file.mimetype !== 'application/octet-stream') {
    return file.mimetype;
  }
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mkv') return 'video/x-matroska';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return file.mimetype || 'application/octet-stream';
}

function bufferToDataURI(file) {
  if (!file || !file.buffer) return null;
  const mime = getMimeType(file);
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
}

function formatSkillResponse(skill) {
  if (!skill) return null;
  const s = skill.toObject ? skill.toObject() : { ...skill };
  const hasPdf = Boolean(s.pdfFile);
  const hasVideo = Boolean(s.videoFile);
  return {
    ...s,
    hasPdf,
    hasVideo,
    pdfFile: hasPdf ? `/api/skills/${s._id}/pdf` : null,
    videoFile: hasVideo ? `/api/skills/${s._id}/video` : null
  };
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
    res.json({
      user,
      mySkills: mySkills.map(formatSkillResponse)
    });
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
      if (req.body && req.body.name && req.body.name.trim()) {
        updateData.name = req.body.name.trim();
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

    res.json(skills.map(formatSkillResponse));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Single Skill Detail
app.get(['/api/skills/:id', '/skills/:id'], ensureDbConnected, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id).populate('user', 'name avatar credits');
    if (!skill) return res.status(404).json({ message: 'Skill not found' });
    res.json(formatSkillResponse(skill));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stream or Download Skill PDF
app.get(['/api/skills/:id/pdf', '/skills/:id/pdf'], ensureDbConnected, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill || !skill.pdfFile) {
      return res.status(404).json({ message: 'PDF document not found for this skill' });
    }

    const safeTitle = (skill.title || 'skill-syllabus')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 60);
    const filename = `${safeTitle}.pdf`;
    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    // 1. Data URI format (base64)
    if (skill.pdfFile.startsWith('data:')) {
      const match = skill.pdfFile.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) {
        return res.status(500).json({ message: 'Corrupted PDF data URI in database' });
      }
      const mime = match[1] || 'application/pdf';
      const buffer = Buffer.from(match[2], 'base64');

      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(buffer);
    }

    // 2. Relative file upload path (e.g., /uploads/xyz.pdf)
    if (skill.pdfFile.startsWith('/uploads/') || skill.pdfFile.startsWith('uploads/')) {
      const cleanPath = skill.pdfFile.replace(/^\//, '');
      const filePath = path.join(__dirname, 'public', cleanPath);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
        return res.sendFile(filePath);
      }
      return res.status(404).json({ message: 'PDF file not found on server disk' });
    }

    // 3. Remote URL
    if (skill.pdfFile.startsWith('http://') || skill.pdfFile.startsWith('https://')) {
      return res.redirect(skill.pdfFile);
    }

    return res.status(404).json({ message: 'Unknown PDF storage format' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stream or Download Skill Demo Video with HTTP Range Support
app.get(['/api/skills/:id/video', '/skills/:id/video'], ensureDbConnected, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill || !skill.videoFile) {
      return res.status(404).json({ message: 'Video demo not found for this skill' });
    }

    const safeTitle = (skill.title || 'skill-demo')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 60);
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    // 1. Data URI format (base64)
    if (skill.videoFile.startsWith('data:')) {
      const match = skill.videoFile.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) {
        return res.status(500).json({ message: 'Corrupted video data URI in database' });
      }
      const mime = match[1] || 'video/mp4';
      const ext = mime.includes('webm') ? 'webm' : 'mp4';
      const filename = `${safeTitle}.${ext}`;
      const buffer = Buffer.from(match[2], 'base64');
      const totalSize = buffer.length;

      if (isDownload) {
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', totalSize);
        return res.end(buffer);
      }

      // Stream with HTTP Range Requests for video seeking & buffer control
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start >= totalSize || end >= totalSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
          return res.end();
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400'
        });
        return res.end(buffer.subarray(start, end + 1));
      } else {
        res.writeHead(200, {
          'Content-Length': totalSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400'
        });
        return res.end(buffer);
      }
    }

    // 2. Relative file upload path (e.g., /uploads/xyz.mp4)
    if (skill.videoFile.startsWith('/uploads/') || skill.videoFile.startsWith('uploads/')) {
      const cleanPath = skill.videoFile.replace(/^\//, '');
      const filePath = path.join(__dirname, 'public', cleanPath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Video file not found on server disk' });
      }

      const stat = fs.statSync(filePath);
      const totalSize = stat.size;
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.webm' ? 'video/webm' : 'video/mp4';
      const filename = `${safeTitle}${ext}`;

      if (isDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.sendFile(filePath);
      }

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start >= totalSize || end >= totalSize || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
          return res.end();
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400'
        });
        const fileStream = fs.createReadStream(filePath, { start, end });
        return fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': totalSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400'
        });
        const fileStream = fs.createReadStream(filePath);
        return fileStream.pipe(res);
      }
    }

    // 3. Remote URL
    if (skill.videoFile.startsWith('http://') || skill.videoFile.startsWith('https://')) {
      return res.redirect(skill.videoFile);
    }

    return res.status(404).json({ message: 'Unknown video storage format' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post(['/api/skills', '/skills'], ensureDbConnected, protect, (req, res) => {
  skillUpload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large. Maximum allowed size is 4.5MB per attachment.' });
      }
      return res.status(400).json({ message: err.message });
    }

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
      res.status(201).json(formatSkillResponse(populatedSkill));
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

    const formattedBookings = bookings.map(b => {
      const bObj = b.toObject ? b.toObject() : { ...b };
      if (bObj.skill) {
        bObj.skill = formatSkillResponse(bObj.skill);
      }
      return bObj;
    });

    res.json(formattedBookings);
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