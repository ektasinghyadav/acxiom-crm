const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
  opportunityName: { type: String, required: true, maxlength: 150, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  amount: { type: Number, required: true, min: 0 },
  stage: { type: String, enum: ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'], default: 'Qualification' },
  probability: { type: Number, required: true, min: 0, max: 100 },
  expectedCloseDate: { type: Date, required: true },
  status: { type: String, enum: ['Open', 'Won', 'Lost'], default: 'Open' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Opportunity', opportunitySchema);