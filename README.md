# UniManga — Manga Reading & Library Management Platform

[![Backend CI](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/backend-ci.yml)
[![Mobile CI](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/mobile-ci.yml/badge.svg)](https://github.com/Souvik-Cyclic/Unimanga/actions/workflows/mobile-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A manga reading and library management platform: an Expo mobile client that
reads from public manga sources, backed by an Express API that keeps each
user's library, categories and reading progress in MongoDB.

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#️-architecture)
- [Repository Layout](#-repository-layout)
- [Getting Started](#-getting-started)
- [Running Locally](#-running-locally)
- [API Reference](#-api-reference)
- [Continuous Integration](#-continuous-integration)
- [Deployment](#-deployment)
- [Configuration](#️-configuration)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

UniManga is a full-stack application consisting of:

- **Mobile App** — React Native (Expo Router) client for Android and iOS
- **Backend API** — Node.js (Express 5) REST API on MongoDB

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

## ✨ Features

### Application

- 📚 **Library management** — save manga, sort them into user-defined categories
- 🔐 **Authentication** — JWT-protected routes, bcrypt-hashed passwords
- 🌐 **Multi-source support** — 10 site adapters behind one extractor factory
- 📖 **Reading history** — chapter progress synced across devices
- 🎨 **Light and dark themes** — shared token palette across every screen
- 🚫 **Ad filtering** — request blocking inside the source WebView

### Platform

- 🐳 **Containerised** — multi-stage Alpine image for the API, dev image for the app
- 🔄 **CI on every push** — lint, tests, typecheck and an image build
- 📑 **Interactive API docs** — Swagger UI served by the API itself
- 🧪 **Endpoint test suite** — Node test runner against an in-memory MongoDB
- 🔒 **Config through environment only** — no secrets in the repository

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph client["📱 Client"]
        app["Expo App<br/>(React Native)"]
        wv["Source WebView<br/>+ site adapters"]
        app <--> wv
    end

    subgraph api["⚙️ Express API — Node.js 20"]
        mw["JWT auth middleware"]
        ctrl["Controllers<br/>auth · manga · library<br/>categories · history · websites"]
        odm["Mongoose models"]
        mw --> ctrl --> odm
    end

    subgraph data["🗄️ Data"]
        db[("MongoDB<br/>users · manga · userManga<br/>categories · readHistory · websites")]
    end

    sites["🌐 Manga source sites"]

    app -- "REST / JSON over HTTPS" --> mw
    wv -- "HTML scrape" --> sites
    odm --> db
```

**Request flow.** The app sends a JWT with every call. `auth.middleware.js`
verifies it and attaches the user, the controller does the work through a
Mongoose model, and the response goes back as JSON. Source scraping never
touches the API — it happens in the WebView on the device.

---

## 📁 Repository Layout

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
    ├── app/               Expo Router screens — (auth) and (main) stacks
    ├── components/        Shared UI components
    ├── constants/         Theme tokens and theme context
    ├── hooks/             Library and WebView hooks
    ├── services/          API and auth clients
    ├── store/             Zustand auth store
    ├── utils/extractors/  Per-site adapters and metadata parsing
    └── Dockerfile         Dev container for the Metro bundler
```

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** 20.x LTS and **npm** 9+
- **MongoDB** — Atlas free tier or a local instance
- **Docker** 20+ *(optional — for the containerised workflow)*
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

## 💻 Running Locally

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
EXPO_PUBLIC_API_URL=http://localhost:3000
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

## 📖 API Reference

With the API running:

- **Swagger UI** — <http://localhost:3000/docs>
- **OpenAPI document** — <http://localhost:3000/docs.json>
- **Health** — `GET /` returns status, docs path and a timestamp

| Base path | Purpose |
