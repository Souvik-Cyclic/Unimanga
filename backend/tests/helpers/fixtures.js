/**
 * Fixtures for the API tests: the rows a library entry needs to exist before
 * a reader can add anything.
 */
import Website from '../../models/website.model.js';
import { api, auth } from './testServer.js';

/** A source the catalogue can hang manga off. */
export async function createWebsite(overrides = {}) {
  return Website.create({
    name: 'TestScans',
    url: 'https://testscans.example',
    language: 'EN',
    color: '#6366F1',
    isActive: true,
    ...overrides,
  });
}

/** The default shelves are seeded at registration; this picks one out. */
export async function firstCategoryId(token) {
  const response = await api().get('/api/categories').set(auth(token));
  return response.body.categories[0]._id;
}

/**
 * Add a series to the reader's library, creating the catalogue entry on the
 * way in, and return the library entry.
 */
export async function addSeries(token, overrides = {}) {
  const categoryId = overrides.categoryId ?? (await firstCategoryId(token));

  const response = await api()
    .post('/api/library')
    .set(auth(token))
    .send({
      title: 'Test Series',
      sourceWebsite: 'TestScans',
      sourceUrl: 'https://testscans.example/series/test-series',
      totalChapters: 100,
      genres: ['manhwa'],
      categoryId,
      readingStatus: 'reading',
      currentChapter: '1',
      ...overrides,
    });

  return response;
}
