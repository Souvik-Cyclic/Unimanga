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

describe('Reading history', () => {
  before(startTestDb);
  after(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    await createWebsite();
  });

  it('records a chapter when progress is saved', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);

    await api()
      .put(`/api/library/${added.body.userManga._id}/progress`)
      .set(auth(token))
      .send({ currentChapter: '12', lastReadUrl: 'https://testscans.example/chapter/12' });

    const response = await api().get('/api/history').set(auth(token));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.total, 1);
    assert.strictEqual(response.body.history[0].chapter, '12');
    assert.strictEqual(
      response.body.history[0].chapterUrl,
      'https://testscans.example/chapter/12'
    );
    assert.strictEqual(response.body.history[0].manga.title, 'Test Series');
  });

  it('keeps one row per chapter when the same chapter is read again', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);

    for (const chapter of ['12', '12', '13']) {
      await api()
        .put(`/api/library/${added.body.userManga._id}/progress`)
        .set(auth(token))
        .send({ currentChapter: chapter });
    }

    const response = await api().get('/api/history').set(auth(token));

    assert.strictEqual(response.body.total, 2, 'chapter 12 was not duplicated');
  });

  it('lists the newest reading first', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);

    for (const chapter of ['1', '2', '3']) {
      await api()
        .put(`/api/library/${added.body.userManga._id}/progress`)
        .set(auth(token))
        .send({ currentChapter: chapter });
    }

    const response = await api().get('/api/history').set(auth(token));

    assert.strictEqual(response.body.history[0].chapter, '3');
  });

  it('does not record the not-started placeholder', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);

    await api()
      .put(`/api/library/${added.body.userManga._id}/progress`)
      .set(auth(token))
      .send({ currentChapter: '0' });

    const response = await api().get('/api/history').set(auth(token));

    assert.strictEqual(response.body.total, 0);
  });

  it('records a chapter posted directly', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);

    const response = await api()
      .post('/api/history')
      .set(auth(token))
      .send({
        mangaId: added.body.userManga.manga._id,
        userMangaId: added.body.userManga._id,
        chapter: '45.5',
        chapterUrl: 'https://testscans.example/chapter/45-5',
      });

    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.entry.chapter, '45.5');
  });

  it('needs a manga and a chapter', async () => {
    const { token } = await createUser();

    const response = await api().post('/api/history').set(auth(token)).send({ chapter: '5' });

    assert.strictEqual(response.status, 400);
  });

  it('honours the limit parameter', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);

    for (const chapter of ['1', '2', '3', '4']) {
      await api()
        .put(`/api/library/${added.body.userManga._id}/progress`)
        .set(auth(token))
        .send({ currentChapter: chapter });
    }

    const response = await api().get('/api/history?limit=2').set(auth(token));

    assert.strictEqual(response.body.count, 2, 'the page is capped');
    assert.strictEqual(response.body.total, 4, 'the total still reports everything');
  });

  it('shows only your own reading', async () => {
    const owner = await createUser({ username: 'owner', email: 'owner@example.com' });
    const stranger = await createUser({ username: 'stranger', email: 'stranger@example.com' });
    const added = await addSeries(owner.token);
    await api()
      .put(`/api/library/${added.body.userManga._id}/progress`)
      .set(auth(owner.token))
      .send({ currentChapter: '7' });

    const response = await api().get('/api/history').set(auth(stranger.token));

    assert.strictEqual(response.body.total, 0);
  });

  it('removes a single entry', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);
    await api()
      .put(`/api/library/${added.body.userManga._id}/progress`)
      .set(auth(token))
      .send({ currentChapter: '7' });

    const before = await api().get('/api/history').set(auth(token));
    const response = await api()
      .delete(`/api/history/${before.body.history[0]._id}`)
      .set(auth(token));
    assert.strictEqual(response.status, 200);

    const afterDelete = await api().get('/api/history').set(auth(token));
    assert.strictEqual(afterDelete.body.total, 0);
  });

  it('clears the whole trail without touching the library', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);
    for (const chapter of ['1', '2']) {
      await api()
        .put(`/api/library/${added.body.userManga._id}/progress`)
        .set(auth(token))
        .send({ currentChapter: chapter });
    }

    const response = await api().delete('/api/history').set(auth(token));
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.removed, 2);

    const history = await api().get('/api/history').set(auth(token));
    assert.strictEqual(history.body.total, 0);

    const library = await api().get('/api/library').set(auth(token));
    assert.strictEqual(library.body.count, 1, 'the series is still tracked');
  });

  it('drops the trail when the series leaves the library', async () => {
    const { token } = await createUser();
    const added = await addSeries(token);
    await api()
      .put(`/api/library/${added.body.userManga._id}/progress`)
      .set(auth(token))
      .send({ currentChapter: '7' });

    await api().delete(`/api/library/${added.body.userManga._id}`).set(auth(token));

    const history = await api().get('/api/history').set(auth(token));
    assert.strictEqual(history.body.total, 0);
  });

  it('requires a token', async () => {
    const response = await api().get('/api/history');

    assert.strictEqual(response.status, 401);
  });
});
