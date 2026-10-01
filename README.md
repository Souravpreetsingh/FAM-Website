# Flamingo aur Maina â€” Luxury Boutique CafÃ© & Mountain Retreat

A luxury hospitality website for Flamingo aur Maina, a boutique cafÃ© and mountain retreat in Jibhi, Himachal Pradesh.

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
| Deployment   | Render (single service: static site + Express API)    |

## Project Structure

```
.
â”œâ”€â”€ public/              # Static HTML site (served by Render)
â”‚   â”œâ”€â”€ assets/frames/   # 240 hero frame images
â”‚   â”œâ”€â”€ css/             # Stylesheets
â”‚   â”œâ”€â”€ js/              # JavaScript (transitions, hero, animations)
â”‚   â””â”€â”€ pages/           # HTML pages (booking, rooms, explore, etc.)
â”œâ”€â”€ src/                 # React app (in development, not deployed)
â”œâ”€â”€ backend/             # Express API + static hosting (deployed on Render)
â”œâ”€â”€ .github/workflows/   # CI pipelines
â””â”€â”€ render.yaml          # Render deployment config
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

There is no Netlify deployment workflow. Deployment is handled entirely by Render.

### GitHub secrets

No deployment secrets are stored in GitHub. Render's environment variables are
configured in the Render dashboard and synced via `render.yaml`.

## Deployment

### Render (single service)

Render builds and serves both the static site and the API from one service:

- Build: `npm install --prefix backend`
- Start: `node backend/server.js`
- Static files are served from `public/` by Express
- API routes are mounted at `/api/v1`

Every push to `main` triggers an automatic Render deploy. The production host
is `https://flamingoaurmaina.com`; `www` redirects to the apex via a Render
custom-domain rule.


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

The frontend calls the backend same-origin; Render serves both from one service:

```
/api/* â†’ https://flamingoaurmaina.com/api/*
```

For local development, the backend runs directly on `http://localhost:5000`.
