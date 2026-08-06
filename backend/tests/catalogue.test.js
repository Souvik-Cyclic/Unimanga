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
import { addSeries, createWebsite } from './helpers/fixtures.js';

describe('Websites', () => {
  before(startTestDb);
  after(stopTestDb);
  beforeEach(clearTestDb);

  it('lists sources without a token, so the sign-in screen can use them', async () => {
    await createWebsite();

    const response = await api().get('/api/websites');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.websites.length, 1);
    assert.strictEqual(response.body.websites[0].name, 'TestScans');
  });

  it('adds a source when signed in', async () => {
    const { token } = await createUser();

    const response = await api()
      .post('/api/websites')
      .set(auth(token))
      .send({ name: 'NewScans', url: 'https://newscans.example', color: '#10B981' });

    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.website.name, 'NewScans');
  });

  it('refuses to add a source without a token', async () => {
    const response = await api()
      .post('/api/websites')
      .send({ name: 'NewScans', url: 'https://newscans.example' });

    assert.strictEqual(response.status, 401);
  });

  it('updates a source', async () => {
    const { token } = await createUser();
    const website = await createWebsite();

    const response = await api()
      .put(`/api/websites/${website._id}`)
      .set(auth(token))
      .send({ isActive: false });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.website.isActive, false);
  });

  it('deletes a source', async () => {
    const { token } = await createUser();
    const website = await createWebsite();

