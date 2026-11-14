const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Manager', 'SalesExecutive'], default: 'SalesExecutive' },
  isActive: { type: Boolean, default: true },
  failedLoginCount: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);