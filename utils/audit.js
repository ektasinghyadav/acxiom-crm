const AuditLog = require('../models/AuditLog');
const plain = x => (x ? JSON.parse(JSON.stringify(x)) : null);

module.exports = async function audit(req, action, entityName, recordId, oldValue, newValue) {
  try {
    await AuditLog.create({
      userId: req.user && req.user.id,
      userName: req.user && req.user.name,
      action, entityName,
      recordId: String(recordId),
      oldValue: plain(oldValue),
      newValue: plain(newValue),
      ipAddress: req.ip
    });
  } catch (e) {
    console.error('Audit failed:', e.message);
  }
};