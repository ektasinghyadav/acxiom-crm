require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
const { requireAuth, requireRole, requirePage } = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/opportunities', require('./routes/opportunities'));
app.use('/api/leads', require('./routes/leads'));

app.get('/leads', requirePage, (req, res) =>
  res.sendFile(path.join(__dirname, 'views', 'leads.html')));

app.get('/opportunities', requirePage, (req, res) =>
  res.sendFile(path.join(__dirname, 'views', 'opportunities.html')));

app.get('/customers', requirePage, (req, res) =>
  res.sendFile(path.join(__dirname, 'views', 'customers.html')));

// protected page
app.get('/dashboard', requirePage, (req, res) =>
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html')));

// test route: only Admin can open it
app.get('/api/admin-test', requireAuth, requireRole('Admin'), (req, res) =>
  res.json({ message: 'Hello Admin' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ errors: ['Something went wrong.'] });
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/acxiomcrm')
  .then(() => app.listen(3000, () => console.log('Running on http://localhost:3000')))
  .catch(err => console.error('DB connection failed:', err.message));