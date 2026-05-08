<p align="center">
  <img src="https://img.shields.io/badge/⚡-RapidShare-blueviolet?style=for-the-badge&labelColor=1a0a2e" alt="RapidShare" height="40"/>
</p>

<h1 align="center">RapidShare — Instant File Sharing</h1>

<p align="center">
  <strong>Upload. Get a code. Share anywhere. No login required.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Express-4.18-000000?style=flat-square&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-7.4-2D3748?style=flat-square&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Cloudinary-☁️-3448C5?style=flat-square" alt="Cloudinary" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Bun-Runtime-F9F1E1?style=flat-square&logo=bun" alt="Bun" />
</p>

---

## ✨ What is RapidShare?

RapidShare is a **zero-friction file-sharing platform** that generates unique 6-character codes for uploaded files. No accounts, no sign-ups — just upload your file and share the code with anyone.

> 📤 **Send:** Drop a file → Get code `XY7K9P` → Share it  
> 📥 **Receive:** Enter code `XY7K9P` → Download instantly

### 🎯 Key Features

| Feature | Description |
|---------|-------------|
| 🚫 **No Login Required** | Zero friction — upload and share instantly |
| 🔐 **Password Protection** | Optionally lock files with bcrypt-encrypted passwords |
| ⏰ **Auto-Expiry** | Files self-destruct after 1hr, 8hr, or 24hr |
| 📊 **Download Limits** | Set max downloads (1–10) per file |
| ☁️ **Direct Cloud Upload** | Files go straight to Cloudinary — fast & scalable |
| 🧹 **Auto-Cleanup** | Expired files & orphaned uploads are cleaned automatically |
| 📱 **Responsive Design** | Beautiful on desktop & mobile |
| 🛡️ **Rate Limited** | Built-in abuse protection |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│                 │     │                 │     │              │
│   Next.js 16    │────▶│   Express.js    │────▶│  PostgreSQL  │
│   React 19      │     │   + Prisma 7    │     │              │
│   Redux Toolkit │     │                 │     └──────────────┘
│   TailwindCSS 4 │     └────────┬────────┘
│                 │              │
└────────┬────────┘              │
         │                       │
         │    ┌──────────────────┘
         │    │
         ▼    ▼
    ┌─────────────────┐
    │                 │
    │   Cloudinary    │
    │   (File Store)  │
    │                 │
    └─────────────────┘
```

### Upload Flow (3-Step Signed Upload)

1. **Get Signed URL** — Frontend requests signed upload params from backend
2. **Direct Upload** — Frontend uploads file directly to Cloudinary's temp folder
3. **Confirm & Move** — Backend moves file to permanent storage, generates share code, saves metadata

### Download Flow

1. User enters 6-character code
2. Backend validates: existence → expiry → download limit → password
3. Returns Cloudinary download URL
4. Download count is incremented

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **State Management:** Redux Toolkit
- **Styling:** Tailwind CSS v4 + Custom animations
- **Forms:** React Hook Form + Zod validation
- **HTTP Client:** Axios with retry + interceptors
- **Icons:** Lucide React
- **Notifications:** React Toastify
- **Drag & Drop:** react-dropzone

### Backend
- **Server:** Express.js 4.18 (TypeScript)
- **ORM:** Prisma 7.4 with PostgreSQL adapter (`@prisma/adapter-pg`)
- **File Storage:** Cloudinary SDK v2
- **Validation:** Joi
- **Security:** Helmet, CORS, express-rate-limit, bcrypt
- **Logging:** Winston (console + file transports)
- **Runtime:** Bun

### Infrastructure
- **Database:** PostgreSQL
- **Containerization:** Docker + Docker Compose
- **Build Runtime:** Bun (multi-stage Docker builds)

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.x) or [Node.js](https://nodejs.org/) (v20+)
- [PostgreSQL](https://www.postgresql.org/) (v15+)
- [Docker](https://www.docker.com/) & Docker Compose (optional)
- [Cloudinary Account](https://cloudinary.com/) (free tier works)

### 🐳 Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/RapidShare.git
cd RapidShare

# Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |

### 💻 Local Development

#### Backend

```bash
cd backend

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your database & Cloudinary credentials

# Generate Prisma client
bun run prisma:generate

# Run database migrations
bun run prisma:migrate

# Start development server
bun run dev
```

#### Frontend

```bash
cd frontend

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Set NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Start development server
bun run dev
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/quickshare

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Limits
MAX_FILE_SIZE=104857600          # 100MB in bytes
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (`frontend/.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## 📡 API Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/` | Health check | ❌ |
| `POST` | `/api/files/get-upload-url` | Get signed Cloudinary upload params | ❌ |
| `POST` | `/api/files/upload-file` | Confirm upload & generate share code | ❌ |
| `POST` | `/api/files/download` | Download file by code | ❌ |
| `GET` | `/api/files/file/:code` | Get file metadata | ❌ |
| `DELETE` | `/api/files/file/:id` | Delete a file | ❌ |

<details>
<summary><b>📋 Request/Response Examples</b></summary>

#### Get Upload URL
```json
// POST /api/files/get-upload-url
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1048576
}

// Response
{
  "success": true,
  "data": {
    "uploadUrl": "https://api.cloudinary.com/v1_1/{cloud}/auto/upload",
    "signature": "abc123...",
    "timestamp": 1715000000,
    "apiKey": "...",
    "cloudName": "...",
    "publicId": "...",
    "folder": "temp"
  }
}
```

#### Confirm Upload
```json
// POST /api/files/upload-file
{
  "cloudinaryUrl": "https://res.cloudinary.com/...",
  "originalName": "document.pdf",
  "mimetype": "application/pdf",
  "size": 1048576,
  "expiry": "2",
  "downloads": 5,
  "usePassword": true,
  "password": "secret123"
}

// Response
{
  "success": true,
  "data": {
    "code": "XY7K9P",
    "expiresAt": "2026-05-09T12:00:00.000Z"
  }
}
```

#### Download File
```json
// POST /api/files/download
{
  "code": "XY7K9P",
  "password": "secret123"
}

// Response
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/..."
  }
}
```

</details>

---

## 🗄️ Database Schema

```prisma
model File {
  id            String   @id @default(uuid())
  code          String   @unique        // 6-char share code
  originalName  String                  // Original filename
  fileName      String                  // Stored filename
  mimetype      String                  // MIME type
  size          Int                     // Size in bytes
  cloudinaryId  String                  // Cloudinary public_id
  cloudinaryUrl String                  // Cloudinary secure URL
  password      String?                 // bcrypt hash (optional)
  expiresAt     DateTime                // Auto-expiry timestamp
  maxDownloads  Int      @default(10)   // Download cap
  downloadCount Int      @default(0)    // Current downloads
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([code])
  @@index([expiresAt])
  @@map("files")
}
```

---

## 📁 Project Structure

```
RapidShare/
├── docker-compose.yml
│
├── backend/
│   ├── dockerfile
│   ├── prisma/schema.prisma
│   └── src/
│       ├── server.ts              # Entry + cron jobs
│       ├── config/                # Cloudinary, DB, Logger
│       ├── controllers/           # Request handlers
│       ├── routes/                # Express routes
│       ├── services/              # Business logic
│       ├── middleware/            # Error handler, validator
│       ├── validators/            # Joi schemas
│       ├── types/                 # TypeScript interfaces
│       ├── utils/                 # Helpers (bcrypt, code gen)
│       └── lib/                   # Prisma client
│
└── frontend/
    ├── dockerfile
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx         # Root layout
        │   ├── page.tsx           # Home page
        │   └── _components/       # UI components
        ├── store/                 # Redux (slices + hooks)
        ├── services/              # API service layer
        ├── types/                 # TS interfaces
        ├── libs/                  # Axios, validation, utils
        └── constants/             # App constants
```

---

## 🔐 Security

- **Helmet** — Secure HTTP headers
- **CORS** — Origin whitelisting
- **Rate Limiting** — 100 requests per 15 minutes per IP
- **Password Hashing** — bcrypt with 10 salt rounds
- **Signed Uploads** — Cloudinary API signature verification
- **Dual Validation** — Joi (server) + Zod (client) schemas
- **File Size Enforcement** — 100MB max at both client and server
- **Auto-Retry** — Exponential backoff for network failures (3 retries)

---

## 🧹 Background Jobs

| Job | Interval | Description |
|-----|----------|-------------|
| `cleanupExpiredFiles()` | Every **60 min** | Deletes expired files from Cloudinary + PostgreSQL |
| `cleanupTempFiles()` | Every **30 min** | Removes orphaned temp uploads older than 1 hour |

---

## 🎨 UI Highlights

- **Aurora Background** — Animated radial gradient blobs with blur effects
- **3D Glass Cube** — CSS `preserve-3d` rotating cube with glassmorphism faces
- **Custom Typography** — Share Tech & Share Tech Mono fonts
- **Gradient Accents** — Indigo → Purple gradient throughout
- **Micro-Animations** — Floating icons, glowing code, hover lift effects
- **Drag & Drop** — Visual dropzone with active state feedback
- **Responsive** — Glassmorphic card layout on desktop, full-width on mobile

---

## 🧑‍💻 Development Scripts

### Backend

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `bun run dev` | Start with hot reload |
| Build | `bun run build` | Compile TypeScript |
| Start | `bun run start` | Run production build |
| Prisma Generate | `bun run prisma:generate` | Generate Prisma client |
| Prisma Migrate | `bun run prisma:migrate` | Run migrations |
| Prisma Studio | `bun run prisma:studio` | Open Prisma GUI |

### Frontend

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `bun run dev` | Start Next.js dev server |
| Build | `bun run build` | Production build |
| Start | `bun run start` | Serve production build |
| Lint | `bun run lint` | Run ESLint |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ using Next.js, Express, Prisma & Cloudinary</sub>
</p>
