# 🎬 Video Metadata Management API

A scalable **Node.js + TypeScript + Express + Prisma + PostgreSQL + Redis** API for managing video metadata.  
Supports **user authentication (JWT)**, **video CRUD operations**, **filtering & pagination**, **Swagger docs**, and **Redis caching**.

---

## 🚀 Features

- User registration & login with JWT authentication
- Video metadata management (CRUD)
- Pagination & filtering (by genre, etc.)
- Caching with Redis (for GET videos)
- Prisma ORM with PostgreSQL
- API documentation with Swagger

---

## 🛠️ Tech Stack

- **Node.js** + **TypeScript**
- **Express.js**
- **Prisma ORM**
- **PostgreSQL**
- **Redis (ioredis)**
- **Swagger UI**
- **Zod** for validation
- **JWT + bcrypt** for authentication

---

## 📦 Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/stephen-lakes/optimalvid.git
cd optimalvid
```

## 📝 TODOs

Planned improvements and tasks:

1. **Project Restructuring**  
   Move logic from `index.ts` into separate folders for better modularity:

2. **Request Validation with Zod**  
   Add schema validation for request bodies (register, login, video creation, etc.).

3. **User-Related Caching**

- Cache frequently accessed user data (`/users/me`, user profile + videos).
- Invalidate cache on user update/delete.

4. **Testing**

- Add Jest + Supertest tests (at least 2 unit tests per endpoint as per project requirement).

5. **Dockerization**

- Add `Dockerfile` and `docker-compose.yml` for Postgres, Redis, and API.

6. **Improved Error Handling & Logging**

- Add centralized error middleware.
- Integrate a logger (like `pino` or `winston`).

7. **Rate Limiting & Security**

- Add rate limiting (e.g., `express-rate-limit`).
- Use Helmet for secure HTTP headers.

8. **CI/CD Setup**

- Add GitHub Actions workflow for linting, tests, and migrations.
