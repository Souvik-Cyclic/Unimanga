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
