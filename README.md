# Flamingo aur Maina — Luxury Boutique Café & Mountain Retreat

A luxury hospitality website for Flamingo aur Maina, a boutique café and mountain retreat in Jibhi, Himachal Pradesh.

## Tech Stack

| Layer        | Technology                                          |
| ------------ | --------------------------------------------------- |
| Frontend     | HTML, CSS, JavaScript, Tailwind CSS                  |
| Backend      | Node.js, Express, Mongoose                           |
| Database     | MongoDB Atlas                                       |
| Auth         | JWT (access + refresh tokens)                       |
| Payments     | Razorpay                                            |
| Media        | Cloudinary                                          |
| Email        | Nodemailer (SMTP)                                   |
| Animations   | GSAP, ScrollTrigger                                 |
| AI           | Custom knowledge base chatbot                        |
| Deployment   | Netlify (frontend), Render (backend)                 |

## Project Structure

```
.
├── public/              # Static HTML site (deployed to Netlify)
│   ├── assets/frames/   # 240 hero frame images
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript (transitions, hero, animations)
│   └── pages/           # HTML pages (booking, rooms, explore, etc.)
├── src/                 # React app (in development, not deployed)
├── api/                 # Netlify Functions wrapper
├── backend/             # Express API server (deployed on Render)
├── .github/workflows/   # CI/CD pipelines
├── netlify.toml         # Netlify deployment config
└── render.yaml          # Render deployment config
```

## Getting Started

### 1. Install Dependencies

This project uses `npm` to manage development dependencies for the static site (like Tailwind CSS).

```bash
npm install
```

### 2. Run the Development Server

To work on the static HTML site, you need to run two commands in separate terminals:

1.  **Start the Tailwind CSS watcher:** This will automatically re-compile your CSS file whenever you make changes to your HTML or JS files.
    ```bash
    npm run dev
    ```
2.  **Serve the `public` directory:** This will start a local server to view your site.
    ```bash
npx serve public -l 3000
```

Opens the hero frames + static pages at `http://localhost:3000`.

### 2. Backend

```bash
cd backend
npm install
# Set up backend/.env with your MongoDB URI and keys
npm start
```

## CI/CD

### GitHub Actions

| Workflow    | Trigger         | Purpose                                   |
| ----------- | --------------- | ----------------------------------------- |
| `ci.yml`    | Pull Request    | Validate required files exist             |
| `deploy.yml` | Push to `main`  | Deploy `public/` to Netlify               |

### Required GitHub Secrets

| Secret                | Description                                  |
| --------------------- | -------------------------------------------- |
| `NETLIFY_AUTH_TOKEN`  | Netlify Personal Access Token                |
| `NETLIFY_SITE_ID`     | Netlify site ID                              |

## Deployment

### Frontend (Static Site)

Every push to `main` triggers an automatic deployment via GitHub Actions:

1. Deploy `public/` to Netlify
2. Clean URLs: `/pages/room` → `/pages/room.html`
3. API proxy: `/api/*` → Render backend

Preview deployments are available via Netlify's GitHub integration.

### Backend (Render)

The backend API is deployed separately on Render (configured via `render.yaml`).

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Backend (backend/.env)
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/fam?retryWrites=true&w=majority
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=Flamingo aur Maina <noreply@flamingoaurmaina.com>
FRONTEND_URL=http://localhost:3000
```

## API

The frontend communicates with the backend via a Netlify proxy:

```
/api/* → https://fam-backend.onrender.com/api/*
```

For local development, the backend runs directly on `http://localhost:5000`.
