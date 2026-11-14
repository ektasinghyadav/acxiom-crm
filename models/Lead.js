const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  leadCode: { type: String, unique: true },
  leadName: { type: String, required: true, maxlength: 100, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  companyName: { type: String, maxlength: 100, trim: true },
  source: { type: String, enum: ['Website', 'Referral', 'Cold Call', 'Email Campaign', 'Event', 'Other'], default: 'Website' },
  status: { type: String, enum: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'], default: 'New' },
  expectedValue: { type: Number, min: 0, max: 100000000, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);