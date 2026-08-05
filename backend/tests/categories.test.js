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

describe('Categories', () => {
  before(startTestDb);
  after(stopTestDb);
  beforeEach(clearTestDb);

  it('lists the shelves seeded with the account', async () => {
    const { token } = await createUser();

    const response = await api().get('/api/categories').set(auth(token));

    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.body.categories));
    assert.ok(response.body.categories.length >= 1);
  });

  it('creates a shelf', async () => {
    const { token } = await createUser();

    const response = await api()
      .post('/api/categories')
      .set(auth(token))
      .send({ name: 'Weekly', color: '#FF4D2E', icon: '📚' });

    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.category.name, 'Weekly');
    assert.strictEqual(response.body.category.color, '#FF4D2E');
  });

  it('refuses a duplicate shelf name for the same reader', async () => {
    const { token } = await createUser();
    await api().post('/api/categories').set(auth(token)).send({ name: 'Weekly' });

    const response = await api()
      .post('/api/categories')
      .set(auth(token))
      .send({ name: 'Weekly' });

    assert.strictEqual(response.status, 400);
  });

  it('lets two readers each have a shelf of the same name', async () => {
    const first = await createUser({ username: 'first', email: 'first@example.com' });
    const second = await createUser({ username: 'second', email: 'second@example.com' });

    await api().post('/api/categories').set(auth(first.token)).send({ name: 'Weekly' });
    const response = await api()
      .post('/api/categories')
      .set(auth(second.token))
      .send({ name: 'Weekly' });

    assert.strictEqual(response.status, 201);
  });

  it('renames a shelf', async () => {
    const { token } = await createUser();
    const created = await api()
      .post('/api/categories')
      .set(auth(token))
      .send({ name: 'Weekly' });

    const response = await api()
      .put(`/api/categories/${created.body.category._id}`)
      .set(auth(token))
      .send({ name: 'Weeklies' });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.category.name, 'Weeklies');
  });

  it('deletes a shelf', async () => {
    const { token } = await createUser();
    const created = await api()
      .post('/api/categories')
      .set(auth(token))
      .send({ name: 'Temporary' });

    const response = await api()
      .delete(`/api/categories/${created.body.category._id}`)
      .set(auth(token));
    assert.strictEqual(response.status, 200);

    const remaining = await api().get('/api/categories').set(auth(token));
    const names = remaining.body.categories.map((category) => category.name);
    assert.ok(!names.includes('Temporary'));
  });

  it('will not touch another reader\'s shelf', async () => {
    const owner = await createUser({ username: 'owner', email: 'owner@example.com' });
    const stranger = await createUser({ username: 'stranger', email: 'stranger@example.com' });
    const created = await api()
      .post('/api/categories')
      .set(auth(owner.token))
      .send({ name: 'Private' });

    const response = await api()
      .delete(`/api/categories/${created.body.category._id}`)
      .set(auth(stranger.token));

    assert.strictEqual(response.status, 404);
  });

  it('requires a token', async () => {
    const response = await api().get('/api/categories');

    assert.strictEqual(response.status, 401);
  });
});
