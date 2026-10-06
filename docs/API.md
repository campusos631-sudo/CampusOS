# CampusOS REST API

Base URL: `https://campusos-5xdm.onrender.com/api`

All request and response bodies are JSON.

## Authentication
Protected routes need the JWT token returned by login or register:

```
Authorization: Bearer <token>
```

The token contains the user id and role, and is valid for 7 days.

**Roles:** `student` and `admin`. A student calling an admin route gets `403`.

## Error format
Every error returns JSON in this shape:
```json
{ "error": "Readable message" }
```

| Code | Meaning |
|---|---|
| 200 / 201 | Success / created |
| 400 | Validation failed, or the action is not allowed in the current state |
| 401 | Not logged in, or token invalid or expired |
| 403 | Logged in but not allowed (wrong role) |
| 404 | Not found |
| 409 | Conflict (duplicate email, duplicate registration or feedback) |
| 429 | Too many requests (rate limit) |
| 500 | Server error |

---

## Health
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | API is running |
| GET | `/health/db` | Public | API can reach the database |

## Auth
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create a student account |
| POST | `/auth/login` | Public | Login, returns token |
| GET | `/auth/me` | Logged in | Current user |

**POST /auth/register**
```json
{
  "name": "Test Student",
  "email": "student@example.com",
  "password": "Test1234",
  "enrollment_no": "2301234",
  "department": "Computer Engineering",
  "semester": 5
}
```
Name 2-100 characters, valid email, password 8-72 characters with a letter and a number. `enrollment_no`, `department` and `semester` (1-8) are optional.
Response `201`: `{ "token": "...", "user": { "id", "name", "email", "role", ... } }`

**POST /auth/login**
```json
{ "email": "student@example.com", "password": "Test1234" }
```
Response `200`: `{ "token": "...", "user": { ... } }`. Wrong email or password both return `401 Invalid email or password`. After 10 failed attempts in 15 minutes the IP gets `429`.

## Categories
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/categories` | Public | List of complaint categories |

## Complaints
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/complaints` | Student | Submit a complaint |
| GET | `/complaints` | Logged in | Student: own complaints. Admin: all complaints |
| GET | `/complaints/:id` | Logged in | One complaint with timeline and feedback |
| PUT | `/complaints/:id/status` | Admin | Change status |
| PUT | `/complaints/:id/assign` | Admin | Assign to a staff member |
| PUT | `/complaints/:id/priority` | Admin | Change priority |
| GET | `/staff` | Admin | Staff list for assigning |

**POST /complaints**
```json
{
  "category_id": 1,
  "title": "PC number 12 is not working",
  "description": "Monitor does not turn on and keyboard is not responding",
  "priority": "High"
}
```
Priority: `Low`, `Medium` (default), `High`, `Critical`. Title 5-150 and description 10-2000 characters.
Response `201`: `{ "complaint": { "id", "ticket_id": "CMP-2026-00001", "title", "priority", "status": "Reported", "created_at" } }`
The complaint, its first timeline entry and a notification are saved in one database transaction.

**GET /complaints** (optional query parameters)
`q` (search in title or ticket ID), `status`, `priority`, `category_id`. Returns up to 100 complaints, newest first.

**GET /complaints/:id**
Response: `{ "complaint": {...}, "timeline": [ { "status", "note", "created_at", "updated_by_name" } ], "feedback": null }`
A student opening another student's complaint gets `404`.

**PUT /complaints/:id/status**
```json
{ "status": "In Progress", "note": "Technician will visit today" }
```
Status: `Reported`, `Assigned`, `In Progress`, `Resolved`, `Rejected`. `Resolved` sets `resolved_at`. A resolved or rejected complaint is closed and cannot be changed (`400`). Adds a timeline entry and notifies the student.

**PUT /complaints/:id/assign**
```json
{ "assigned_to": 2 }
```
A newly reported complaint moves to `Assigned`.

**PUT /complaints/:id/priority**
```json
{ "priority": "Critical" }
```

## Analytics
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/analytics/summary` | Admin | Live statistics from the database |

Response fields: `total`, `pending`, `in_progress`, `resolved`, `rejected`, `high_priority`, `resolution_rate` (%), `avg_resolution_hours`, `by_category`, `by_priority`, `feedback: { average, count }`.

## Announcements
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/announcements` | Logged in | Latest announcements |
| POST | `/announcements` | Admin | Publish (all students are notified) |
| DELETE | `/announcements/:id` | Admin | Delete |

**POST /announcements**
```json
{
  "title": "GTU Internal Examination Schedule",
  "body": "Internal examination will begin from Monday.",
  "is_important": true
}
```

## Events
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/events` | Logged in | Events with seat count and "am I registered" |
| POST | `/events` | Admin | Create an event |
| DELETE | `/events/:id` | Admin | Delete an event |
| POST | `/events/:id/register` | Student | Register |
| DELETE | `/events/:id/register` | Student | Cancel registration |
| GET | `/events/:id/registrations` | Admin | Participant list |

**POST /events**
```json
{
  "title": "Annual Technical Fest",
  "description": "Project exhibition and competitions",
  "event_date": "2026-11-20",
  "event_time": "10:00",
  "location": "Seminar Hall",
  "capacity": 100
}
```
Registering fails with `400` if the event is full or already over, and `409` if the student is already registered. The event row is locked during registration so the capacity can never be exceeded.

## Feedback
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/feedback` | Student | Rate own resolved complaint |
| GET | `/feedback` | Admin | All feedback with average rating |

**POST /feedback**
```json
{ "complaint_id": 1, "rating": 4, "comment": "Fixed quickly" }
```
Rating 1-5. Allowed only for the student's own complaint, only when it is `Resolved`, and only once (`409` if repeated).

## Notifications
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/notifications` | Logged in | My latest 30 notifications and unread count |
| PUT | `/notifications/read-all` | Logged in | Mark all as read |
| PUT | `/notifications/:id/read` | Logged in | Mark one as read |

Notifications are created automatically when a complaint is submitted, assigned or changes status, when an announcement is published, and when a student registers for an event. A user can only read and change their own notifications.
