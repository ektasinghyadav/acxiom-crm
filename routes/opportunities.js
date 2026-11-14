const express = require('express');
const mongoose = require('mongoose');
const Opportunity = require('../models/Opportunity');
const Customer = require('../models/Customer');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const STAGES = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const isSales = req => req.user.role === 'SalesExecutive';
const scope = req => (isSales(req) ? { assignedTo: req.user.id } : {});
const custScope = req => (isSales(req) ? { createdBy: req.user.id } : {});

const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

// BUSINESS + SERVER-SIDE VALIDATION
function validate(b) {
  const e = [];
  if (!b.opportunityName || !b.opportunityName.trim()) e.push('Opportunity Name is required.');
  else if (b.opportunityName.trim().length > 150) e.push('Opportunity Name must be 150 characters or less.');
  if (!b.customerId) e.push('Customer is required.');
  else if (!mongoose.isValidObjectId(b.customerId)) e.push('Invalid customer.');
  if (!STAGES.includes(b.stage)) e.push('Select a valid stage.');

  const active = b.stage !== 'Won' && b.stage !== 'Lost';
  const amount = Number(b.amount);
  if (b.amount === undefined || b.amount === '' || isNaN(amount)) e.push('Opportunity Amount is required.');
  else if (amount < 0) e.push('Opportunity Amount cannot be negative.');
  else if (active && amount <= 0) e.push('Opportunity Amount must be greater than 0.');

  const prob = Number(b.probability);
  if (b.probability === undefined || b.probability === '' || isNaN(prob) || prob < 0 || prob > 100)
    e.push('Probability must be between 0 and 100.');

  if (!b.expectedCloseDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.expectedCloseDate)) e.push('Expected Close Date is required.');
  else if (active && b.expectedCloseDate < todayStr()) e.push('Expected Close Date cannot be in the past.');
  return e;
}

const statusFor = stage => (stage === 'Won' ? 'Won' : stage === 'Lost' ? 'Lost' : 'Open');
const build = b => ({
  opportunityName: b.opportunityName.trim(),
  customerId: b.customerId,
  amount: Number(b.amount),
  stage: b.stage,
  probability: Number(b.probability),
  expectedCloseDate: new Date(b.expectedCloseDate),
  status: statusFor(b.stage)
});

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ errors: ['Invalid id.'] });
  next();
});

// LIST + SEARCH + FILTER + PAGINATION
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const filter = { ...scope(req) };
  const q = (req.query.q || '').trim();
  if (q) filter.opportunityName = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.status) filter.status = req.query.status;
  const total = await Opportunity.countDocuments(filter);
  const data = await Opportunity.find(filter).populate('customerId', 'customerName')
    .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ data, total, page, pages: Math.ceil(total / limit) });
});

// CREATE
router.post('/', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const cust = await Customer.findOne({ _id: req.body.customerId, ...custScope(req) });
  if (!cust) return res.status(400).json({ errors: ['Selected customer was not found.'] });
  const o = await Opportunity.create({ ...build(req.body), assignedTo: req.user.id });
  await audit(req, 'Create', 'Opportunity', o._id, null, o);
  res.status(201).json(o);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const o = await Opportunity.findOne({ _id: req.params.id, ...scope(req) });
  if (!o) return res.status(404).json({ errors: ['Opportunity not found.'] });
  const cust = await Customer.findOne({ _id: req.body.customerId, ...custScope(req) });
  if (!cust) return res.status(400).json({ errors: ['Selected customer was not found.'] });
  const before = o.toObject();
  Object.assign(o, build(req.body));
  await o.save();
  await audit(req, 'Update', 'Opportunity', o._id, before, o);
  res.json(o);
});

// DELETE (Admin / Manager)
router.delete('/:id', requireRole('Admin', 'Manager'), async (req, res) => {
  const o = await Opportunity.findByIdAndDelete(req.params.id);
  if (!o) return res.status(404).json({ errors: ['Opportunity not found.'] });
  await audit(req, 'Delete', 'Opportunity', o._id, o, null);
  res.json({ message: 'Opportunity deleted.' });
});

module.exports = router;