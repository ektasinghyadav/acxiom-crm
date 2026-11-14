const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);   // every customer route needs login

const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const phoneOk = p => /^[6-9]\d{9}$/.test(p);   // 10-digit Indian mobile
const FIELDS = ['customerName', 'email', 'phone', 'companyName', 'address', 'city', 'state', 'status'];

// Sales Executives only see their own customers; Admin/Manager see all
const scope = req => (req.user.role === 'SalesExecutive' ? { createdBy: req.user.id } : {});

const pick = b => Object.fromEntries(
  FIELDS.filter(f => b[f] !== undefined).map(f => [f, typeof b[f] === 'string' ? b[f].trim() : b[f]])
);

function validate(b) {
  const errors = [];
  const name = (b.customerName || '').trim();
  if (!name) errors.push('Customer Name is required.');
  else if (name.length > 100) errors.push('Customer Name must be 100 characters or less.');
  if (!b.email) errors.push('Email is required.');
  else if (!emailOk(b.email.trim())) errors.push('Enter a valid email address.');
  if (!b.phone) errors.push('Phone is required.');
  else if (!phoneOk(b.phone.trim())) errors.push('Enter a valid 10-digit phone number.');
  if (b.status && !['Active', 'Inactive'].includes(b.status)) errors.push('Invalid status.');
  return errors;
}

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ errors: ['Invalid id.'] });
  next();
});

// LIST + SEARCH + PAGINATION
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const filter = { ...scope(req) };
  const q = (req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ customerName: rx }, { email: rx }, { phone: rx }, { companyName: rx }];
  }
  if (req.query.status) filter.status = req.query.status;
  const total = await Customer.countDocuments(filter);
  const data = await Customer.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ data, total, page, pages: Math.ceil(total / limit) });
});

// GET ONE
router.get('/:id', async (req, res) => {
  const c = await Customer.findOne({ _id: req.params.id, ...scope(req) });
  if (!c) return res.status(404).json({ errors: ['Customer not found.'] });
  res.json(c);
});

// CREATE
router.post('/', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const email = req.body.email.trim().toLowerCase();
  const phone = req.body.phone.trim();
  if (await Customer.findOne({ email })) return res.status(409).json({ errors: ['A customer with this email already exists.'] });
  if (await Customer.findOne({ phone })) return res.status(409).json({ errors: ['A customer with this phone already exists.'] });

  const c = await Customer.create({
    ...pick(req.body), email, phone,
    customerCode: 'CUST-' + Date.now().toString(36).toUpperCase(),
    createdBy: req.user.id
  });
  await audit(req, 'Create', 'Customer', c._id, null, c);
  res.status(201).json(c);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const c = await Customer.findOne({ _id: req.params.id, ...scope(req) });
  if (!c) return res.status(404).json({ errors: ['Customer not found.'] });

  const email = req.body.email.trim().toLowerCase();
  const phone = req.body.phone.trim();
  if (await Customer.findOne({ email, _id: { $ne: c._id } })) return res.status(409).json({ errors: ['A customer with this email already exists.'] });
  if (await Customer.findOne({ phone, _id: { $ne: c._id } })) return res.status(409).json({ errors: ['A customer with this phone already exists.'] });

  const before = c.toObject();
  Object.assign(c, pick(req.body), { email, phone });
  await c.save();
  await audit(req, 'Update', 'Customer', c._id, before, c);
  res.json(c);
});

// DELETE (Admin / Manager only)
router.delete('/:id', requireRole('Admin', 'Manager'), async (req, res) => {
  const c = await Customer.findByIdAndDelete(req.params.id);
  if (!c) return res.status(404).json({ errors: ['Customer not found.'] });
  await audit(req, 'Delete', 'Customer', c._id, c, null);
  res.json({ message: 'Customer deleted.' });
});

module.exports = router;