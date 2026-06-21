# Backend

Node.js + Express + MongoDB REST API.

## Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express
- **Database**: MongoDB (Mongoose)
- **Auth**: JWT (jsonwebtoken) + bcrypt

## Folder Structure

```
Backend/
├── src/
│   ├── index.js          # Express app entry point
│   ├── config/
│   │   └── db.js         # MongoDB connection
│   ├── models/           # Mongoose schemas
│   ├── routes/            # API routes
│   ├── controllers/       # Route handlers
│   └── middleware/
│       └── auth.js        # JWT verify
├── .env.example
└── package.json
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Set MONGO_URI and JWT_SECRET in .env

# 3. Start dev server
npm run dev
# → http://localhost:5000
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for signing JWTs |
