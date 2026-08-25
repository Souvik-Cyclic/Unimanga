/**
 * The Express application: routes, middleware, and the API reference.
 *
 * Kept apart from index.js so tests can mount the same app against their own
 * database without opening a port or connecting to the real one.
 */
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes.js';
import categoryRoutes from './routes/category.routes.js';
import libraryRoutes from './routes/library.routes.js';
import mangaRoutes from './routes/manga.routes.js';
import websiteRoutes from './routes/website.routes.js';
import historyRoutes from './routes/history.routes.js';
import { openApiSpec } from './docs/openapi.js';

const app = express();

// Enable CORS for all origins (for development)
app.use(cors());
app.use(express.json());

const safeEqual = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

const docsAuth = (req, res, next) => {
  const user = process.env.DOCS_USER;
  const password = process.env.DOCS_PASSWORD;
  if (!user || !password) return next();

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    const given = decoded.slice(0, sep);
    const givenPassword = decoded.slice(sep + 1);
    if (sep !== -1 && safeEqual(given, user) && safeEqual(givenPassword, password)) {
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="UniManga API docs", charset="UTF-8"');
  return res.status(401).json({ message: 'Authentication required' });
};

// Interactive API reference. /docs.json serves the raw OpenAPI document for
// client generators and import into Postman/Insomnia.
app.get('/docs.json', docsAuth, (req, res) => res.json(openApiSpec));
app.use(
  '/docs',
  docsAuth,
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'UniManga API',
    swaggerOptions: { persistAuthorization: true },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/manga', mangaRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/history', historyRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'UniManga  is running!',
    status: 'healthy',
    docs: '/docs',
    timestamp: new Date().toISOString(),
  });
});

export default app;
