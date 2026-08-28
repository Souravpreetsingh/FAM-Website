const AuditLog = require('../models/AuditLog');

async function log(req, { action, entity = 'booking', entityId = '', changes = {} } = {}) {
  try {
    await AuditLog.create({
      admin: req.user ? req.user._id : null,
      adminEmail: req.user ? req.user.email || '' : '',
      action,
      entity,
      entityId: String(entityId || ''),
      changes,
      ip: req.ip || '',
      userAgent: (req.headers && req.headers['user-agent']) || '',
    });
  } catch (e) {
    // Fire-and-forget: audit logging must never break a request.
  }
}

module.exports = { log };