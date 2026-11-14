# AcxiomCRM

A role-based CRM web application built with **Node.js, Express and MongoDB** for the Acxiom Consulting technical round. It covers authentication, role-based authorization, customers, leads, opportunities, validation and audit logging.

**Live demo:** <your Render link>/login.html
**Built by:** <your name>

## Tech stack

- Backend: Node.js, Express 5
- Database: MongoDB Atlas with Mongoose
- Authentication: bcryptjs (password hashing), JWT stored in an httpOnly cookie
- Frontend: HTML, CSS and vanilla JavaScript (fetch API)

## Features implemented

### Authentication and security
- Register, login and logout
- Passwords hashed with bcrypt, never stored in plain text
- Password policy: minimum 8 characters with uppercase, lowercase and a number
- Account lockout: 5 failed logins locks the account for 15 minutes
- Protected pages (redirect to login) and protected API routes (401 if not logged in)
- Server-side role checks (403 if the role is not allowed)

### Roles
| Role | Access |
|------|--------|
| Admin | All records, can delete |
| Manager | All records, can delete |
| SalesExecutive | Only their own customers, leads and opportunities, cannot delete |

The first registered user becomes **Admin**. Everyone who registers after that becomes a **SalesExecutive**.

### Customer management
- Create, view, edit, delete, search (name, email, phone, company), status filter, pagination
- Required, email format, 10-digit phone and length validation
- Email and phone uniqueness, duplicate customers rejected

### Lead management
- Create, edit, delete, search, status filter, pagination
- Statuses: New, Contacted, Qualified, Unqualified, Converted, Lost
- Status workflow enforced on the server (for example New cannot jump straight to Qualified)
- Convert a Qualified lead into a Customer and an Opportunity in one click

### Opportunity management
- Create, edit, delete, search, stage and status filters, pagination
- Stages: Qualification, Proposal, Negotiation, Won, Lost
- Business rules for active opportunities: amount greater than 0, probability between 0 and 100, expected close date not in the past
- Weighted pipeline shown as Amount x Probability / 100

### Validation
- Client-side validation for required, email, phone, length, date and numeric fields
- The same rules repeated on the server, so bypassing the browser does not work
- User-friendly messages, no technical errors exposed

### Audit logging
- Create, update, delete and lead-conversion actions are stored in the `auditlogs` collection
- Each entry records user, action, entity, record id, old value, new value, IP address and timestamp

## REST API

All endpoints require login (cookie). Delete requires Admin or Manager.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| GET, POST | /api/customers | List (search, filter, paging) / create |
| GET, PUT, DELETE | /api/customers/:id | Get / update / delete |
| GET, POST | /api/leads | List / create |
| PUT, DELETE | /api/leads/:id | Update / delete |
| POST | /api/leads/:id/convert | Convert to customer and opportunity |
| GET, POST | /api/opportunities | List / create |
| PUT, DELETE | /api/opportunities/:id | Update / delete |

Status codes used: 200, 201, 400, 401, 403, 404, 409.

## Run locally

1. Clone the repo and install dependencies:
   ```
   npm install
   ```
2. Create a `.env` file in the project root:
   ```
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=any_long_random_text
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open `https://acxiom-crm-0kcj.onrender.com/login.html`, register (the first user becomes Admin) and log in.

## Project structure

```
models/        Mongoose schemas (User, Customer, Lead, Opportunity, AuditLog)
routes/        Express routes (auth, customers, leads, opportunities)
middleware/    Authentication and role checks
utils/         Audit logging helper
public/        Login and register page
views/         Protected pages (dashboard, customers, leads, opportunities)
server.js      App entry point
```

## Not yet implemented

Due to the 3-hour time limit these were not completed: dashboard KPI cards and charts, follow-up management, activity management, user and role administration screen, audit log viewer, reports, login events in the audit log, and anti-forgery tokens.