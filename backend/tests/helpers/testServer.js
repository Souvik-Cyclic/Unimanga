/**
 * Test harness: an in-memory MongoDB plus the real Express app.
 *
 * Tests run against the same routes and controllers the server uses, so they
 * exercise validation, auth, and persistence together — but never touch the
 * real database or open a port.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../app.js';

let memoryServer;

/** Boot the in-memory database and point mongoose at it. */
export async function startTestDb() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
}

/** Tear everything down so the test process can exit. */
export async function stopTestDb() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}

/** Empty every collection between tests, so cases cannot leak into each other. */
export async function clearTestDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

/** A supertest client bound to the app under test. */
export const api = () => request(app);

/**
 * Register an account and return its token plus the created user, which is
 * what most protected-route tests need before they can do anything.
 */
export async function createUser(overrides = {}) {
  const payload = {
    username: 'reader',
    email: 'reader@example.com',
    password: 'sixchars',
    ...overrides,
  };

  const response = await api().post('/api/auth/register').send(payload);
  return { token: response.body.token, user: response.body.user, payload };
}

/** The Authorization header shape every protected route expects. */
export const auth = (token) => ({ Authorization: `Bearer ${token}` });
