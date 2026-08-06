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
      assert.strictEqual(response.body.username, 'reader');
      assert.strictEqual(response.body.password, undefined);
    });

    it('refuses a request with no token', async () => {
      const response = await api().get('/api/auth/me');

      assert.strictEqual(response.status, 401);
    });

    it('refuses a token that is not ours', async () => {
      const response = await api().get('/api/auth/me').set(auth('not.a.real.token'));

      assert.strictEqual(response.status, 401);
    });
  });

  describe('account management', () => {
    it('updates the username and email', async () => {
      const { token } = await createUser();

      const response = await api()
        .put('/api/auth/profile')
        .set(auth(token))
        .send({ username: 'newname', email: 'new@example.com' });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.user.username, 'newname');
      assert.strictEqual(response.body.user.email, 'new@example.com');
    });

    it('refuses an email another account already uses', async () => {
      await createUser({ username: 'first', email: 'taken@example.com' });
      const { token } = await createUser({ username: 'second', email: 'second@example.com' });

      const response = await api()
        .put('/api/auth/profile')
        .set(auth(token))
        .send({ email: 'taken@example.com' });

      assert.strictEqual(response.status, 400);
    });

    it('changes the password and signs in with the new one', async () => {
      const { token, payload } = await createUser();

      const change = await api()
        .put('/api/auth/password')
        .set(auth(token))
        .send({ currentPassword: payload.password, newPassword: 'brand-new-pass' });
      assert.strictEqual(change.status, 200);

      const oldPassword = await api()
        .post('/api/auth/login')
        .send({ email: payload.email, password: payload.password });
      assert.strictEqual(oldPassword.status, 400, 'the old password stops working');

      const newPassword = await api()
        .post('/api/auth/login')
        .send({ email: payload.email, password: 'brand-new-pass' });
      assert.strictEqual(newPassword.status, 200);
    });

    it('will not change the password without the current one', async () => {
      const { token } = await createUser();

      const response = await api()
        .put('/api/auth/password')
        .set(auth(token))
        .send({ currentPassword: 'wrong', newPassword: 'brand-new-pass' });

      assert.strictEqual(response.status, 400);
    });

    it('deletes the account once the password is confirmed', async () => {
      const { token, payload } = await createUser();

      const response = await api()
        .delete('/api/auth/account')
        .set(auth(token))
        .send({ password: payload.password });
      assert.strictEqual(response.status, 200);

      const afterDelete = await api()
        .post('/api/auth/login')
        .send({ email: payload.email, password: payload.password });
      assert.strictEqual(afterDelete.status, 404, 'the account is gone');
    });
  });
});
