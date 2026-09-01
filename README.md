# UniManga - Manga Reading & Library Management Platform

[![Backend CI](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/backend-ci.yml)
[![Mobile CI](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/mobile-ci.yml/badge.svg)](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/mobile-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A manga reading and library management platform: an Expo mobile client that
reads from public manga sources, backed by an Express API that keeps each
user's library, categories and reading progress in MongoDB.

**Live API:** <https://unimanga-471g.onrender.com> · **API reference:** <https://unimanga-471g.onrender.com/docs>

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Installation](#installation)
- [Setting Up Locally](#setting-up-locally)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Continuous Integration](#continuous-integration)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

UniManga is a full-stack application consisting of:

- **Mobile App** - React Native (Expo Router) client for Android and iOS
- **Backend API** - Node.js (Express 5) REST API on MongoDB

Manga pages are never mirrored. The client opens each source site in a
WebView and a per-site adapter extracts titles, covers and chapter lists from
the live page; the API only stores what a user saved and how far they read.

**Technology Stack**

| Layer | Choice |
|-------|--------|
| Mobile | React Native, Expo Router, NativeWind (Tailwind), Zustand |
| Backend | Node.js 20, Express 5, Mongoose, JWT, Swagger UI |
| Data | MongoDB (Atlas or local) |
| Tooling | Docker, ESLint, Node test runner, GitHub Actions |

---

## Features

### Application

- **Library management** - save manga, sort them into user-defined categories
- **Authentication** - JWT-protected routes, bcrypt-hashed passwords
- **Multi-source support** - 10 site adapters behind one extractor factory
- **Reading history** - chapter progress synced across devices
- **Light and dark themes** - shared token palette across every screen
- **Ad filtering** - request blocking inside the source WebView

### Platform

- **Containerised** - multi-stage Alpine image for the API, dev image for the app
- **CI on every push** - lint, tests, typecheck and an image build
- **Interactive API docs** - Swagger UI served by the API itself
- **Endpoint test suite** - Node test runner against an in-memory MongoDB
- **Config through environment only** - no secrets in the repository

---

## Screenshots

| Sign in | Create account | Library |
|:---:|:---:|:---:|
| <img src="screenshots/01-login.png" width="230" alt="Login screen"> | <img src="screenshots/02-signup.png" width="230" alt="Signup screen"> | <img src="screenshots/09-library.png" width="230" alt="Library with a saved series"> |

| Sources | In-app browser | Series details |
|:---:|:---:|:---:|
| <img src="screenshots/04-sources.png" width="230" alt="Registered manga sources"> | <img src="screenshots/05-browser.png" width="230" alt="Source site inside the in-app browser"> | <img src="screenshots/07-quick-view.png" width="230" alt="Scraped metadata in the quick view panel"> |

| Shelves | Reading history | Account |
|:---:|:---:|:---:|
| <img src="screenshots/08-shelf-picker.png" width="230" alt="Choosing a shelf for a series"> | <img src="screenshots/10-history.png" width="230" alt="Reading history"> | <img src="screenshots/11-profile.png" width="230" alt="Account screen with theme switch"> |

Both palettes ship together - the same library on paper rather than ink:

<img src="screenshots/12-light-theme.png" width="230" alt="Library in the light theme">

## Architecture

```mermaid
flowchart TB
    subgraph client["Client"]
        app["Expo App<br/>(React Native)"]
        wv["Source WebView<br/>+ site adapters"]
        app <--> wv
    end

    subgraph api["Express API - Node.js 20"]
        mw["JWT auth middleware"]
        ctrl["Controllers<br/>auth · manga · library<br/>categories · history · websites"]
        odm["Mongoose models"]
        mw --> ctrl --> odm
    end

    subgraph data["Data"]
        db[("MongoDB<br/>users · manga · userManga<br/>categories · readHistory · websites")]
    end

    sites["Manga source sites"]

    app -- "REST / JSON over HTTPS" --> mw
    wv -- "HTML scrape" --> sites
    odm --> db
```

**Request flow.** The app sends a JWT with every call. `auth.middleware.js`
verifies it and attaches the user, the controller does the work through a
Mongoose model, and the response goes back as JSON. Source scraping never
touches the API - it happens in the WebView on the device.

---

## Repository Layout

```
.
├── .github/workflows/     Backend and mobile CI pipelines
├── backend/               Express API
│   ├── config/            MongoDB connection
│   ├── controllers/       Request handlers
│   ├── docs/              OpenAPI document served at /docs
│   ├── middleware/        JWT verification
│   ├── models/            Mongoose schemas
│   ├── routes/            Route definitions per resource
│   ├── scripts/           Seeding and maintenance scripts
│   ├── tests/             Endpoint tests (in-memory MongoDB)
│   └── Dockerfile         Multi-stage production image
└── mobile-app/            Expo React Native client
    ├── app/               Expo Router screens - (auth) and (main) stacks
    ├── components/        Shared UI components
    ├── constants/         Theme tokens and theme context
    ├── hooks/             Library and WebView hooks
    ├── services/          API and auth clients
    ├── store/             Zustand auth store
    ├── utils/extractors/  Per-site adapters and metadata parsing
    └── Dockerfile         Dev container for the Metro bundler
```

---

## Installation

Just want the app? Grab the latest APK from the
[Releases page](https://github.com/Souvik-Cyclic/Unimanga/releases/latest) -
no build step needed, it talks to the hosted API out of the box.

| File | Use for |
|------|---------|
| [`unimanga-1.0.1-arm64-v8a.apk`](https://github.com/Souvik-Cyclic/Unimanga/releases/download/v1.0.1/unimanga-1.0.1-arm64-v8a.apk) | Any phone from the last decade (64-bit) |
| [`unimanga-1.0.1-armeabi-v7a.apk`](https://github.com/Souvik-Cyclic/Unimanga/releases/download/v1.0.1/unimanga-1.0.1-armeabi-v7a.apk) | Older 32-bit devices |

Download, allow installs from unknown sources when prompted, and install.

---

## Setting Up Locally

For development, or to run against your own backend instead of the hosted one.

### Prerequisites

- **Node.js** 20.x LTS and **npm** 9+
- **MongoDB** - Atlas free tier or a local instance
- **Docker** 20+ *(optional - for the containerised workflow)*
- **Expo Go** on a phone, or an Android/iOS emulator

### Quick Start

```bash
git clone https://github.com/Souvik-Cyclic/Unimanga.git
cd Unimanga

# 1. API
cd backend
npm install
cp .env.example .env          # fill in MONGO_URI and JWT_SECRET
npm start                     # http://localhost:3000

# 2. Mobile app (second terminal)
cd ../mobile-app
npm install
cp .env.example .env          # point EXPO_PUBLIC_API_URL at the API
npx expo start
```

Seed the supported source sites once the API is connected:

```bash
cd backend
node scripts/seedWebsites.js
```

---

## Running Locally

### Backend API

```bash
cd backend
npm install
npm start          # node index.js
npm run dev        # nodemon, auto-reload
npm test           # endpoint suite
npm run lint       # eslint
```

`.env` in `backend/`:

```env
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/unimanga?retryWrites=true&w=majority
JWT_SECRET=change-this-to-a-long-random-string
PORT=3000
NODE_ENV=development
```

### Mobile App

```bash
cd mobile-app
npm install
npx expo start
```

- press `a` for an Android emulator, `i` for an iOS simulator
- or scan the QR code with Expo Go

`.env` in `mobile-app/`:

```env
# Deployed API
EXPO_PUBLIC_API_URL=https://unimanga-471g.onrender.com

# Or a local backend
# EXPO_PUBLIC_API_URL=http://localhost:3000
```

> On a physical device `localhost` points at the phone. Use the machine's LAN
> address (for example `http://192.168.1.5:3000`) instead.

### With Docker

```bash
# API
cd backend
docker build -t unimanga-backend:local .
docker run -d --name unimanga-backend -p 3000:3000 \
  -e MONGO_URI="your-mongodb-uri" \
  -e JWT_SECRET="your-jwt-secret" \
  -e PORT=3000 \
  unimanga-backend:local

curl http://localhost:3000/          # health payload

# Mobile dev container (Metro bundler)
cd ../mobile-app
docker build -t unimanga-mobile:dev .
docker run --rm -it -p 8081:8081 -p 19000:19000 unimanga-mobile:dev
```

---

## API Reference

Deployed instance:

- **Base URL** - <https://unimanga-471g.onrender.com>
- **Swagger UI** - <https://unimanga-471g.onrender.com/docs>
- **OpenAPI document** - <https://unimanga-471g.onrender.com/docs.json>
- **Health** - <https://unimanga-471g.onrender.com/> returns status, docs path and a timestamp

Running locally the same paths sit under <http://localhost:3000>.

**The reference is behind HTTP Basic auth** - the browser prompts on first
visit:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `password` |

```bash
curl -u admin:password https://unimanga-471g.onrender.com/docs.json
```

Set `DOCS_USER` and `DOCS_PASSWORD` to change them; leave either unset and the
docs are served without a prompt, which is the default for local development.

> The API is on Render's free tier, so the first request after a period of
> inactivity takes a few seconds while the instance wakes up.

| Base path | Purpose |
|-----------|---------|
| `/api/auth` | Register, login, profile, password change, account deletion |
| `/api/manga` | Catalogue search and manga details |
| `/api/library` | A user's saved manga |
| `/api/categories` | User-defined library categories |
| `/api/history` | Reading history and chapter progress |
| `/api/websites` | Supported source registry |

Every route except register, login and health expects
`Authorization: Bearer <access token>`.

---

## Continuous Integration

Two GitHub Actions workflows run on pushes to `main` and on pull requests.
Each is path-filtered, so backend changes do not rebuild the app and vice
versa.

```mermaid
flowchart LR
    push["git push / PR"] --> be
    push --> mo

    subgraph be["backend-ci.yml - backend/**"]
        b1["npm ci"] --> b2["eslint"] --> b3["node --test"] --> b4["docker build<br/>+ smoke run"]
    end

    subgraph mo["mobile-ci.yml - mobile-app/**"]
        m1["npm ci"] --> m2["tsc --noEmit"] --> m3["expo-doctor"]
    end
```

| Workflow | Trigger paths | Steps |
|----------|---------------|-------|
| `backend-ci.yml` | `backend/**` | install  lint  test  build and smoke-run the Docker image |
| `mobile-ci.yml` | `mobile-app/**` | install  TypeScript typecheck  `expo-doctor` project validation |

**Why each step is there**

- **Lint** - catches unused bindings and syntax slips before review.
- **Tests** - the endpoint suite runs against an in-memory MongoDB, so a
  broken contract fails the build without any external service.
- **Docker build and smoke run** - proves the image still starts, which a unit
  test cannot tell you.
- **Typecheck** - the app is TypeScript end to end; `tsc --noEmit` is the
  cheapest way to keep screens and adapters in sync.
- **expo-doctor** - flags dependency versions that Expo SDK 54 does not support.

---

## Deployment

### API image

```bash
docker build -t <registry-user>/unimanga-backend:latest backend
docker login
docker push <registry-user>/unimanga-backend:latest
```

Run it anywhere with `MONGO_URI`, `JWT_SECRET` and `PORT` set. The image runs
as a non-root user and ships a `HEALTHCHECK` that polls `/`.

The hosted instance runs on Render at <https://unimanga-471g.onrender.com>,
built from `backend/` on every push to `main`.

### Mobile builds

Build profiles live in `mobile-app/eas.json`:

```bash
cd mobile-app
npx eas build --profile preview --platform android
```

---

## Configuration

### Backend - `backend/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | - (required) |
| `JWT_SECRET` | Signing secret for access and refresh tokens | - (required) |
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | Runtime environment | `development` |
| `DOCS_USER` | Basic auth username for `/docs` and `/docs.json` | unset - docs open |
| `DOCS_PASSWORD` | Basic auth password for the docs | unset - docs open |

### Mobile - `mobile-app/.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Base URL of the API | `http://localhost:3000` |

### ESLint - `backend/.eslintrc.json`

```json
{
  "env": { "node": true, "es2020": true },
  "extends": "eslint:recommended",
  "parserOptions": { "ecmaVersion": 2020, "sourceType": "module" },
  "rules": { "no-unused-vars": "warn", "no-console": "off" }
}
```

---

## Testing

The suite uses the Node test runner with `supertest` and
`mongodb-memory-server`, so no database has to be running.

```bash
cd backend
npm test            # every suite
npm run test:watch  # re-run on change
```

| File | Covers |
|------|--------|
| `tests/health.test.js` | Health endpoint |
| `tests/auth.test.js` | Signup, login, refresh, protected routes |
| `tests/catalogue.test.js` | Manga search and pagination |
| `tests/categories.test.js` | Category CRUD |
| `tests/library.test.js` | Library add/remove and category assignment |
| `tests/history.test.js` | Reading history and progress sync |

Shared helpers live in `tests/helpers/` - `testServer.js` mounts the same
Express app the server uses, `fixtures.js` creates users and manga.

---

## Contributing

```bash
git checkout -b feat/your-feature
# work, then:
npm run lint && npm test
git commit -m "feat(library): add bulk category assignment"
git push origin feat/your-feature
```

Open a pull request once CI is green.

### Code standards

- **JavaScript / TypeScript** - ES2020+, `async`/`await` over promise chains
- **Naming** - camelCase for values, PascalCase for components and classes
- **Comments** - explain why, not what; JSDoc on exported functions
- **Tests** - an endpoint test for every new route

### Commit format

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`.

---

## License

Released under the MIT License.

---

## Acknowledgments

- **Expo** - React Native tooling and OTA workflow
- **MongoDB Atlas** - free-tier cloud database
- **Swagger UI** - the interactive API reference

---

## Contact & Support

- **Issues** - <https://github.com/Souvik-Cyclic/Unimanga/issues>
- **Pull requests** - <https://github.com/Souvik-Cyclic/Unimanga/pulls>

---

## Roadmap

**Phase 1 - Core (done)**
- [x] Authenticated REST API on MongoDB
- [x] Expo client with library, reader and history
- [x] Source adapters for 10 manga sites
- [x] Dockerised API and CI on both projects

**Phase 2 - Hardening**
- [ ] Security scanning (SAST and dependency audit) in CI
- [ ] Automated image publishing on tagged releases
- [ ] Rate limiting and refresh tokens

**Phase 3 - Observability**
- [ ] Structured request logging
- [ ] Metrics and alerting

**Phase 4 - Performance**
- [ ] Catalogue caching layer
- [ ] Offline chapter storage on device
