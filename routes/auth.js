const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, SECRET } = require('../middleware/auth');

const router = express.Router();
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordOk = p => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required.' });
  if (!emailOk(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (!passwordOk(password)) return res.status(400).json({ message: 'Password needs 8+ characters with uppercase, lowercase and a number.' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email already registered.' });

  const isFirst = (await User.countDocuments()) === 0;
  const user = await User.create({
    name, email,
    passwordHash: await bcrypt.hash(password, 10),
    role: isFirst ? 'Admin' : 'SalesExecutive'
  });
  res.status(201).json({ message: 'Registered. You can log in now.', role: user.role });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  const fail = () => res.status(401).json({ message: 'Invalid email or password.' });
  if (!user || !user.isActive) return fail();

  if (user.lockoutUntil && user.lockoutUntil > new Date())
    return res.status(423).json({ message: 'Account locked. Try again in 15 minutes.' });

  const match = await bcrypt.compare(password || '', user.passwordHash);
  if (!match) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= 5) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.failedLoginCount = 0;
    }
    await user.save();
    return fail();
  }

  user.failedLoginCount = 0;
  user.lockoutUntil = null;
  await user.save();

  const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, SECRET, { expiresIn: '1h' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged in.', name: user.name, role: user.role });
});

// LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out.' });
});

// WHO AM I
router.get('/me', requireAuth, (req, res) => res.json(req.user));

module.exports = router;