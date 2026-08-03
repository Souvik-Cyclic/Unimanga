import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import { api, startTestDb, stopTestDb } from './helpers/testServer.js';

describe('Service endpoints', () => {
  before(startTestDb);
  after(stopTestDb);

  it('reports that the API is running', async () => {
    const response = await api().get('/');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 'healthy');
    assert.strictEqual(response.body.docs, '/docs');
    assert.ok(response.body.timestamp, 'a timestamp is included');
  });

  it('serves the OpenAPI document', async () => {
    const response = await api().get('/docs.json');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.openapi, '3.0.3');
    assert.strictEqual(response.body.info.title, 'UniManga API');
  });

  it('documents every mounted route family', async () => {
    const { body } = await api().get('/docs.json');
    const paths = Object.keys(body.paths);

    for (const family of ['/api/auth/login', '/api/categories', '/api/library', '/api/manga', '/api/websites', '/api/history']) {
      assert.ok(paths.includes(family), `${family} is documented`);
    }
  });

  it('serves the Swagger UI', async () => {
    const response = await api().get('/docs/');

    assert.strictEqual(response.status, 200);
    assert.match(response.text, /swagger/i);
  });
});
