# CampusOS: ER Diagram

```mermaid
erDiagram
    USERS ||--o{ COMPLAINTS : submits
    USERS |o--o{ COMPLAINTS : "is assigned"
    CATEGORIES ||--o{ COMPLAINTS : classifies
    COMPLAINTS ||--o{ COMPLAINT_UPDATES : "has timeline"
    USERS |o--o{ COMPLAINT_UPDATES : makes
    COMPLAINTS ||--o| FEEDBACK : receives
    USERS ||--o{ FEEDBACK : gives
    USERS |o--o{ ANNOUNCEMENTS : posts
    USERS |o--o{ EVENTS : creates
    EVENTS ||--o{ EVENT_REGISTRATIONS : has
    USERS ||--o{ EVENT_REGISTRATIONS : registers
    USERS ||--o{ NOTIFICATIONS : receives

    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        string role
        string enrollment_no
        string department
        int semester
    }
    CATEGORIES {
        int id PK
        string name UK
    }
    COMPLAINTS {
        int id PK
        string ticket_id UK
        int user_id FK
        int category_id FK
        int assigned_to FK
        string title
        string description
        string priority
        string status
        string image_url
        timestamp created_at
        timestamp resolved_at
    }
    COMPLAINT_UPDATES {
        int id PK
        int complaint_id FK
        int updated_by FK
        string status
        string note
        timestamp created_at
    }
    FEEDBACK {
        int id PK
        int complaint_id FK
        int user_id FK
        int rating
        string comment
    }
    ANNOUNCEMENTS {
        int id PK
        int created_by FK
        string title
        string body
        boolean is_important
    }
    EVENTS {
        int id PK
        int created_by FK
        string title
        date event_date
        time event_time
        string location
        int capacity
    }
    EVENT_REGISTRATIONS {
        int id PK
        int event_id FK
        int user_id FK
    }
    NOTIFICATIONS {
        int id PK
        int user_id FK
        string message
        string type
        boolean is_read
    }
```

## Relationships

- One user submits many complaints (one-to-many).
- One category groups many complaints (one-to-many).
- One complaint has many status updates, which form its timeline (one-to-many).
- One complaint has at most one feedback (one-to-one).
- Users and events are many-to-many, resolved through `event_registrations`.
- One user receives many notifications (one-to-many).
