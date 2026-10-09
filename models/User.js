const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  credits: { type: Number, default: 3 } // নতুন ইউজার সাইনআপ করলে ৩ ক্রেডিট পাবে
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);