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
import { addSeries, createWebsite, firstCategoryId } from './helpers/fixtures.js';

describe('Library', () => {
  before(startTestDb);
  after(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    await createWebsite();
  });

  describe('adding a series', () => {
    it('creates the catalogue entry and files it on a shelf', async () => {
      const { token } = await createUser();

      const response = await addSeries(token);

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.userManga.manga.title, 'Test Series');
      assert.strictEqual(response.body.userManga.status, 'reading');
      assert.ok(response.body.userManga.category._id, 'the shelf is populated');
    });

    it('reuses the catalogue entry when two readers add the same source URL', async () => {
      const first = await createUser({ username: 'first', email: 'first@example.com' });
      const second = await createUser({ username: 'second', email: 'second@example.com' });

      const one = await addSeries(first.token);
      const two = await addSeries(second.token);

      assert.strictEqual(two.status, 201);
      assert.strictEqual(
        one.body.userManga.manga._id,
        two.body.userManga.manga._id,
        'both point at one catalogue row'
      );
    });

    it('refuses the same series twice for one reader', async () => {
      const { token } = await createUser();
      await addSeries(token);

      const response = await addSeries(token);

      assert.strictEqual(response.status, 400);
      assert.match(response.body.message, /already in your library/i);
    });

    it('needs either a catalogue id or a source URL', async () => {
      const { token } = await createUser();
      const categoryId = await firstCategoryId(token);

      const response = await api()
        .post('/api/library')
        .set(auth(token))
        .send({ title: 'No URL', categoryId });

      assert.strictEqual(response.status, 400);
    });

    it('rejects a source website that does not exist', async () => {
      const { token } = await createUser();

      const response = await addSeries(token, { sourceWebsite: 'NoSuchSite' });

      assert.strictEqual(response.status, 400);
      assert.match(response.body.message, /not found/i);
    });
  });

  describe('listing and filtering', () => {
    it('returns only your own entries', async () => {
      const owner = await createUser({ username: 'owner', email: 'owner@example.com' });
      const stranger = await createUser({ username: 'stranger', email: 'stranger@example.com' });
      await addSeries(owner.token);

      const mine = await api().get('/api/library').set(auth(owner.token));
      const theirs = await api().get('/api/library').set(auth(stranger.token));

      assert.strictEqual(mine.body.count, 1);
      assert.strictEqual(theirs.body.count, 0);
    });

    it('filters by reading status', async () => {
      const { token } = await createUser();
      await addSeries(token);
      await addSeries(token, {
        title: 'Queued Series',
        sourceUrl: 'https://testscans.example/series/queued',
        readingStatus: 'plan-to-read',
        currentChapter: '0',
      });

      const reading = await api()
        .get('/api/library?status=reading')
        .set(auth(token));

      assert.strictEqual(reading.body.count, 1);
      assert.strictEqual(reading.body.library[0].manga.title, 'Test Series');
    });
  });

  describe('updating an entry', () => {
    it('saves chapter progress', async () => {
      const { token } = await createUser();
      const added = await addSeries(token);

      const response = await api()
        .put(`/api/library/${added.body.userManga._id}/progress`)
        .set(auth(token))
        .send({ currentChapter: '12', progress: 12 });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.userManga.currentChapter, '12');
      assert.strictEqual(response.body.userManga.progress, 12);
      assert.ok(response.body.userManga.lastReadAt, 'the read time is stamped');
    });

    it('marks a finished series as complete', async () => {
      const { token } = await createUser();
      const added = await addSeries(token);

      const response = await api()
        .put(`/api/library/${added.body.userManga._id}/progress`)
        .set(auth(token))
        .send({ currentChapter: '100', status: 'completed' });

      assert.strictEqual(response.body.userManga.status, 'completed');
      assert.strictEqual(response.body.userManga.progress, 100);
