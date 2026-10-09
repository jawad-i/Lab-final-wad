const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  credits: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);