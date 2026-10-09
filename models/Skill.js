 const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  pdfFile: { type: String, default: null },   // Stores URL path like /uploads/17123456-file.pdf
  videoFile: { type: String, default: null }, // Stores URL path like /uploads/17123456-video.mp4
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Skill', skillSchema);