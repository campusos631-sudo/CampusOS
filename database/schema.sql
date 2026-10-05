-- CampusOS database schema (PostgreSQL)

CREATE TABLE users (
  id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'student'
                CHECK (role IN ('student', 'admin')),
  enrollment_no VARCHAR(30),
  department    VARCHAR(80),
  semester      SMALLINT CHECK (semester BETWEEN 1 AND 8),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);

CREATE SEQUENCE complaint_ticket_seq START 1;

CREATE TABLE complaints (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id   VARCHAR(20) NOT NULL UNIQUE
              DEFAULT ('CMP-' || to_char(now(), 'YYYY') || '-' ||
                       lpad(nextval('complaint_ticket_seq')::text, 5, '0')),
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES categories(id),
  title       VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  priority    VARCHAR(10) NOT NULL DEFAULT 'Medium'
              CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status      VARCHAR(15) NOT NULL DEFAULT 'Reported'
              CHECK (status IN ('Reported', 'Assigned', 'In Progress', 'Resolved', 'Rejected')),
  image_url   TEXT,
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE complaint_updates (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status       VARCHAR(15) NOT NULL,
  note         TEXT,
  updated_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  complaint_id INT NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
  id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  body         TEXT NOT NULL,
  is_important BOOLEAN NOT NULL DEFAULT false,
  created_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  event_time  TIME NOT NULL,
  location    VARCHAR(150) NOT NULL,
  capacity    INT NOT NULL CHECK (capacity > 0),
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_registrations (
  id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id      INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE notifications (
  id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  type       VARCHAR(30) NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_complaints_user   ON complaints(user_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_updates_complaint ON complaint_updates(complaint_id);
CREATE INDEX idx_notif_user        ON notifications(user_id, is_read);

INSERT INTO categories (name) VALUES
  ('Computer Lab'), ('Classroom'), ('Electrical'), ('Internet/Wi-Fi'),
  ('Water'), ('Furniture'), ('Cleanliness'), ('Security'), ('Other');
