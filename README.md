# Whazzonline — Backend API

REST API for the Whazzonline e-commerce platform. Built with Express, TypeScript, and SQLite.

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js + Express | Lightweight, widely supported, fast to iterate |
| Language | TypeScript | Type safety across all routes and middleware |
| Database | SQLite | Lightweight embedded database stored locally in `data/whazzonline.db` |
| Auth | JWT Auth | Industry-standard token-based auth with bcrypt-secured passwords |
| Validation | express-validator | Declarative input validation on every route |
| Security | helmet, cors | HTTP header hardening and CORS control |

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Create a new account |
| POST | `/api/auth/login` | — | Login, returns JWT tokens |
| POST | `/api/auth/logout` | ✅ | Invalidate session |
| POST | `/api/auth/refresh` | — | Refresh access token |
| GET | `/api/auth/me` | ✅ | Get current user |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | — | List all products (supports `?q=`, `?category=`, `?sort=`) |
| GET | `/api/products/:id` | — | Get single product |

### Cart
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | ✅ | Get user's cart |
| POST | `/api/cart` | ✅ | Add item to cart |
| PATCH | `/api/cart/:id` | ✅ | Update item quantity |
| DELETE | `/api/cart/:id` | ✅ | Remove item |
| DELETE | `/api/cart` | ✅ | Clear entire cart |

### Orders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/orders` | ✅ | Get user's orders |
| GET | `/api/orders/:id` | ✅ | Get single order |
| POST | `/api/orders` | ✅ | Create order (checkout) |

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Update the `.env` file with your local settings:
- `SQLITE_DB_PATH` for the SQLite file location (default: `./data/whazzonline.db`)
- `JWT_SECRET` for signing auth tokens
- `ALLOWED_ORIGIN` for the frontend origin

### 3. Set up the database
The SQLite database initializes automatically on first run using the schema and seed data defined in the backend. If you want to reset the local database, delete `./data/whazzonline.db` and restart the server.

### 4. Start dev server
```bash
npm run dev
# API runs on http://localhost:5000
```

## Deployment (Render)

1. Push to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add all environment variables from `.env.example`
6. Set `ALLOWED_ORIGIN` to your Vercel frontend URL

## Authentication Flow

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Tokens are obtained from `POST /api/auth/login` and should be refreshed using `POST /api/auth/refresh` before expiry (default: 1 hour).

## Known Limitations

- No rate limiting (would add `express-rate-limit` in production)
- No payment gateway integration (Paystack is the recommended next step for Nigeria)
- No image upload endpoint (would use a separate storage service)
- Orders are created with `status: pending` — no webhook for payment confirmation yet
