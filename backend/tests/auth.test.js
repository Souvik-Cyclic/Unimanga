import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import {
  api,
  auth,
  clearTestDb,
  createUser,
  startTestDb,
  stopTestDb,
} from './helpers/testServer.js';

describe('Auth', () => {
  before(startTestDb);
  after(stopTestDb);
  beforeEach(clearTestDb);

  describe('registration', () => {
    it('creates an account and returns a token', async () => {
      const response = await api()
        .post('/api/auth/register')
        .send({ username: 'reader', email: 'reader@example.com', password: 'sixchars' });

      assert.strictEqual(response.status, 201);
      assert.ok(response.body.token, 'a token comes back');
      assert.strictEqual(response.body.user.email, 'reader@example.com');
      assert.strictEqual(response.body.user.password, undefined, 'the hash is never returned');
    });

    it('seeds the default shelves for a new account', async () => {
      const { token } = await createUser();

      const response = await api().get('/api/categories').set(auth(token));

      assert.strictEqual(response.status, 200);
      assert.ok(response.body.categories.length > 0, 'shelves exist straight away');
    });

    it('refuses a second account on the same email', async () => {
      await createUser();

      const response = await api()
        .post('/api/auth/register')
        .send({ username: 'other', email: 'reader@example.com', password: 'sixchars' });

      assert.strictEqual(response.status, 400);
      assert.match(response.body.message, /already exists/i);
    });
  });

  describe('login', () => {
    it('signs in with the right password', async () => {
      const { payload } = await createUser();

      const response = await api()
        .post('/api/auth/login')
        .send({ email: payload.email, password: payload.password });

      assert.strictEqual(response.status, 200);
      assert.ok(response.body.token);
    });

    it('rejects the wrong password', async () => {
      const { payload } = await createUser();

      const response = await api()
        .post('/api/auth/login')
        .send({ email: payload.email, password: 'not-the-password' });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.token, undefined);
    });

    it('reports an unknown email as not found', async () => {
      const response = await api()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'sixchars' });

      assert.strictEqual(response.status, 404);
    });
  });

  describe('protected routes', () => {
    it('returns the signed-in account', async () => {
      const { token } = await createUser();

      const response = await api().get('/api/auth/me').set(auth(token));

      assert.strictEqual(response.status, 200);
      // The account is returned flat, not wrapped in a `user` key.
      assert.strictEqual(response.body.email, 'reader@example.com');
