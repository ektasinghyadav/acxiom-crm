const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Please log in.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Access denied.' });
    next();
  };
}

function requirePage(req, res, next) {
  try { jwt.verify(req.cookies.token, SECRET); next(); }
  catch { res.redirect('/login.html'); }
}

module.exports = { requireAuth, requireRole, requirePage, SECRET };