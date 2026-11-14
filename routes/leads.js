const express = require('express');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Opportunity = require('../models/Opportunity');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const SOURCES = ['Website', 'Referral', 'Cold Call', 'Email Campaign', 'Event', 'Other'];
const STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
// WORKFLOW: which status can move to which
const TRANSITIONS = {
  New: ['Contacted', 'Lost'],
  Contacted: ['Qualified', 'Unqualified', 'Lost'],
  Qualified: ['Converted', 'Lost'],
  Unqualified: ['Lost'],
  Converted: [],
  Lost: []
};

const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const phoneOk = p => /^[6-9]\d{9}$/.test(p);
const scope = req => (req.user.role === 'SalesExecutive' ? { assignedTo: req.user.id } : {});

function validate(b) {
  const e = [];
  const name = (b.leadName || '').trim();
  if (!name) e.push('Lead Name is required.');
  else if (name.length > 100) e.push('Lead Name must be 100 characters or less.');
  if (!b.email) e.push('Email is required.');
  else if (!emailOk(b.email.trim())) e.push('Enter a valid email address.');
  if (!b.phone) e.push('Phone is required.');
  else if (!phoneOk(b.phone.trim())) e.push('Enter a valid 10-digit phone number.');
  if (b.source && !SOURCES.includes(b.source)) e.push('Invalid lead source.');
  if (b.status && !STATUSES.includes(b.status)) e.push('Invalid lead status.');
  const v = Number(b.expectedValue || 0);
  if (isNaN(v) || v < 0 || v > 100000000) e.push('Expected Value must be between 0 and 100000000.');
  return e;
}

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ errors: ['Invalid id.'] });
  next();
});

// LIST
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const filter = { ...scope(req) };
  const q = (req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ leadName: rx }, { companyName: rx }, { email: rx }];
  }
  if (req.query.status) filter.status = req.query.status;
  const total = await Lead.countDocuments(filter);
  const data = await Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ data, total, page, pages: Math.ceil(total / limit) });
});

// CREATE (always starts as "New")
router.post('/', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const b = req.body;
  const lead = await Lead.create({
    leadCode: 'LEAD-' + Date.now().toString(36).toUpperCase(),
    leadName: b.leadName.trim(), email: b.email.trim().toLowerCase(), phone: b.phone.trim(),
    companyName: (b.companyName || '').trim(), source: b.source || 'Website',
    expectedValue: Number(b.expectedValue || 0), status: 'New', assignedTo: req.user.id
  });
  await audit(req, 'Create', 'Lead', lead._id, null, lead);
  res.status(201).json(lead);
});

// UPDATE (enforces status workflow)
router.put('/:id', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const lead = await Lead.findOne({ _id: req.params.id, ...scope(req) });
  if (!lead) return res.status(404).json({ errors: ['Lead not found.'] });
  if (lead.status === 'Converted') return res.status(400).json({ errors: ['Converted leads cannot be edited.'] });

  const b = req.body;
  const newStatus = b.status || lead.status;
  if (newStatus !== lead.status) {
    if (newStatus === 'Converted')
      return res.status(400).json({ errors: ['Use the Convert button to convert a qualified lead.'] });
    if (!TRANSITIONS[lead.status].includes(newStatus))
      return res.status(400).json({ errors: [`Cannot change status from ${lead.status} to ${newStatus}.`] });
  }
  const before = lead.toObject();
  Object.assign(lead, {
    leadName: b.leadName.trim(), email: b.email.trim().toLowerCase(), phone: b.phone.trim(),
    companyName: (b.companyName || '').trim(), source: b.source || lead.source,
    expectedValue: Number(b.expectedValue || 0), status: newStatus
  });
  await lead.save();
  await audit(req, 'Update', 'Lead', lead._id, before, lead);
  res.json(lead);
});

// CONVERT: Qualified lead -> Customer + Opportunity
router.post('/:id/convert', async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, ...scope(req) });
  if (!lead) return res.status(404).json({ errors: ['Lead not found.'] });
  if (lead.status !== 'Qualified') return res.status(400).json({ errors: ['Only Qualified leads can be converted.'] });
  if (!(lead.expectedValue > 0)) return res.status(400).json({ errors: ['Set an Expected Value greater than 0 before converting.'] });
  if (await Customer.findOne({ email: lead.email })) return res.status(409).json({ errors: ['A customer with this email already exists.'] });
  if (await Customer.findOne({ phone: lead.phone })) return res.status(409).json({ errors: ['A customer with this phone already exists.'] });

  const customer = await Customer.create({
    customerCode: 'CUST-' + Date.now().toString(36).toUpperCase(),
    customerName: lead.leadName, email: lead.email, phone: lead.phone,
    companyName: lead.companyName, status: 'Active', createdBy: lead.assignedTo
  });
  const close = new Date();
  close.setDate(close.getDate() + 30);
  const opp = await Opportunity.create({
    opportunityName: `${lead.leadName} - Opportunity`, customerId: customer._id, leadId: lead._id,
    amount: lead.expectedValue, stage: 'Qualification', probability: 20,
    expectedCloseDate: close, status: 'Open', assignedTo: lead.assignedTo
  });
  const before = lead.toObject();
  lead.status = 'Converted';
  await lead.save();
  await audit(req, 'Convert', 'Lead', lead._id, before, lead);
  await audit(req, 'Create', 'Customer', customer._id, null, customer);
  await audit(req, 'Create', 'Opportunity', opp._id, null, opp);
  res.json({ message: 'Lead converted to customer and opportunity.' });
});

// DELETE (Admin / Manager)
router.delete('/:id', requireRole('Admin', 'Manager'), async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) return res.status(404).json({ errors: ['Lead not found.'] });
  await audit(req, 'Delete', 'Lead', lead._id, lead, null);
  res.json({ message: 'Lead deleted.' });
});

module.exports = router;