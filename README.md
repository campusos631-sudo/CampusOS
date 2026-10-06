<p align="center">
  <img src="frontend/img/logo.jpg" alt="KDP logo" width="110" />
</p>

<h1 align="center">KDP CampusOS</h1>
<p align="center"><b>One Digital Platform for a Smarter Campus</b><br>
Smart College Management &amp; Service Platform for Kilachand Devchand Polytechnic, Patan</p>

**Live demo:** https://campusos-5xdm.onrender.com
*(Hosted on a free plan. If the site was idle, the first load can take up to a minute.)*

---

## 1. About the project
CampusOS is a web platform where students report campus problems (broken PC in a lab, no water, Wi-Fi down) as tickets, and the college admin assigns, tracks and resolves them. Every ticket has a unique ID and a full status timeline. The platform also provides announcements, events with registration, feedback and in-app notifications, and an analytics dashboard for the admin.

## 2. Problem statement
Complaints on campus are usually given verbally or on paper, so they get lost, nobody knows their status, and the management has no data about recurring problems. CampusOS replaces this with one transparent digital system.

## 3. Features

**Student**
- Register, login, secure session (JWT)
- Submit a complaint with category and priority, and get a unique ticket ID (e.g. `CMP-2026-00001`)
- Track complaint status and the complete timeline (Reported → Assigned → In Progress → Resolved / Rejected)
- Give a 1-5 star rating and comment after a complaint is resolved
- View announcements, view events, register or cancel registration
- In-app notifications (bell icon)

**Admin**
- View all complaints, search by title or ticket ID, filter by status, priority and category
- Assign complaints to staff, change priority, update status with a note
- Analytics dashboard with live charts: total, pending, in progress, resolved, resolution rate, average resolution time, high-priority open complaints, category-wise and priority-wise charts
- View student feedback and average rating
- Publish announcements (important ones are highlighted)
- Create events, see the participant list

## 4. Technology stack
| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (no framework), Chart.js |
| Backend | Node.js, Express.js (REST API) |
| Database | PostgreSQL (Supabase, free tier) |
| Authentication | JWT, bcrypt password hashing |
| Security | Helmet, rate limiting, express-validator, parameterized SQL |
| Hosting | Render (app), Supabase (database) |
| Version control | Git and GitHub |

## 5. System architecture
```
User Browser (HTML / CSS / JS)
        |  HTTPS, JSON, JWT in Authorization header
        v
REST API: Node.js + Express
   - security middleware (Helmet, rate limit)
   - authentication (JWT) and role check (student / admin)
   - validation, business logic, transactions
        |  SQL (parameterized queries)
        v
PostgreSQL database (Supabase)
```

## 6. Database design
9 tables: `users`, `categories`, `complaints`, `complaint_updates`, `feedback`, `announcements`, `events`, `event_registrations`, `notifications`.
The ER diagram is in [`docs/ER-diagram.md`](docs/ER-diagram.md) and the SQL is in [`database/schema.sql`](database/schema.sql).

Main relationships: one user submits many complaints; one complaint has many status updates (its timeline) and at most one feedback; users and events are many-to-many through `event_registrations`.

## 7. API documentation
See [`docs/API.md`](docs/API.md).

## 8. Security measures
- Passwords are hashed with bcrypt, never stored as plain text
- JWT authentication on all protected routes
- Role-based authorization: admin routes return 403 for students
- The role is decided only by the server, nobody can register as admin
- Input validation on every write endpoint
- Parameterized SQL queries (protects against SQL injection)
- Output escaping in the frontend (protects against XSS)
- Helmet security headers, request size limit, login and register rate limiting
- Database transactions keep complaint, timeline and notification data consistent
- Secrets are stored only as environment variables on the server, and `.env` is in `.gitignore`
- The database Data API is disabled, only the backend can access the database

## 9. Project structure
```
CampusOS/
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── config/db.js
│       ├── middleware/auth.js
│       └── routes/  (auth, complaints, complaintAdmin, analytics,
│                     announcements, events, feedback, notifications)
├── frontend/
│   ├── index.html, login.html, dashboard.html, admin.html,
│   │   analytics.html, announcements.html, events.html
│   ├── css/style.css
│   ├── js/app.js
│   └── img/logo.jpg
├── database/schema.sql
├── docs/  (ER-diagram.md, API.md)
├── screenshots/
└── README.md
```

## 10. Run it yourself
Requirements: Node.js 18+, a PostgreSQL database.

1. Clone the repository
2. Run the SQL in `database/schema.sql` on your PostgreSQL database
3. In `backend/`, create a `.env` file:
   ```
   DATABASE_URL=your_postgres_connection_string
   JWT_SECRET=a_long_random_secret
   ```
4. Install and start:
   ```
   cd backend
   npm install
   npm start
   ```
5. Open `http://localhost:3000`

To create an admin, register a normal account and then run in the database:
`UPDATE users SET role = 'admin' WHERE email = 'your_email';`

## 11. Deployment
Deployed on Render (free web service) connected to this GitHub repository, so every push to `main` deploys automatically. Environment variables `DATABASE_URL`, `JWT_SECRET` and `NODE_ENV` are set in the Render dashboard.

## 12. Limitations
- Free hosting sleeps after inactivity, so the first request can be slow
- Notifications are checked by polling every minute, not real time
- No image upload for complaints yet
- Only two roles (student and admin)
- No email or SMS notifications

## 13. Future scope
- Image upload for complaints
- Teacher and technician roles
- Real-time notifications using WebSockets
- Email notifications
- Mobile app or installable PWA
- Complaint escalation if not resolved within a time limit

## 14. Developed by
I am Vishal Solanki, Diploma Computer Engineering, Kilachand Devchand Polytechnic, Patan

## License
MIT
