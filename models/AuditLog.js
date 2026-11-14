const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  action: String,        // Create, Update, Delete, Login...
  entityName: String,    // Customer, Lead...
  recordId: String,
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  ipAddress: String
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('AuditLog', auditSchema);