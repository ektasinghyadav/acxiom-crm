const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerCode: { type: String, unique: true },
  customerName: { type: String, required: true, maxlength: 100, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true },
  companyName: { type: String, maxlength: 100, trim: true },
  address: { type: String, maxlength: 300 },
  city: { type: String, maxlength: 60 },
  state: { type: String, maxlength: 60 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
