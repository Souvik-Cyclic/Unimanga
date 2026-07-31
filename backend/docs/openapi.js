/**
 * OpenAPI 3.1 description of the UniManga API.
 *
 * Served as interactive documentation at /docs and as raw JSON at /docs.json.
 * Keep this in sync with the route files when endpoints change.
 */

const bearerAuth = [{ bearerAuth: [] }];

/** Standard { message } error body used by every failure path. */
const errorResponse = (description) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

const jsonBody = (schema, required = true) => ({
  required,
  content: { 'application/json': { schema } },
});

const jsonResponse = (description, schema) => ({
  description,
  content: { 'application/json': { schema } },
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'UniManga API',
    version: '1.0.0',
    description:
      'Backend for the UniManga reader: accounts, shelves (categories), the manga catalogue, ' +
      'reading-progress tracking, and the list of supported source websites.\n\n' +
      'Every endpoint marked with a padlock needs a bearer token from `POST /api/auth/login` ' +
      'or `POST /api/auth/register`. Click **Authorize** and paste the token to try them here.',
  },
  servers: [
    { url: '/', description: 'This server' },
  ],
  tags: [
    { name: 'Auth', description: 'Registration, sign-in, and account management' },
    { name: 'Categories', description: 'The shelves a reader files series under' },
    { name: 'Library', description: 'A reader’s tracked series and chapter progress' },
    { name: 'Manga', description: 'The shared catalogue of series' },
    { name: 'Websites', description: 'Sources the reader can browse' },
    { name: 'History', description: 'The trail of chapters a reader has opened' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Send the login token as `Authorization: Bearer <token>`.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'User not found' },
          error: { type: 'string', description: 'Present on 500 responses only' },
        },
      },
      AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '66b1f0c2e5a4c21f3c9a1234' },
          username: { type: 'string', example: 'souvik' },
          email: { type: 'string', format: 'email', example: 'souvik@gmail.com' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login successful' },
          user: { $ref: '#/components/schemas/AuthUser' },
          token: { type: 'string', description: 'JWT, valid for one day' },
        },
      },
      Website: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'AsuraScans' },
          url: { type: 'string', format: 'uri', example: 'https://asuracomic.net' },
          language: { type: 'string', example: 'EN' },
          color: { type: 'string', example: '#8B5CF6', description: 'Hex colour used in the app' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Reading' },
          user: { type: 'string' },
          color: { type: 'string', example: '#6366F1' },
          icon: { type: 'string', example: '📖' },
          order: { type: 'integer', example: 0 },
          isDefault: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Manga: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string', example: 'Solo Leveling' },
          alternativeTitles: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          author: { type: 'string' },
          artist: { type: 'string' },
          coverImage: { type: 'string', format: 'uri' },
          genres: { type: 'array', items: { type: 'string' }, example: ['manhwa', 'Action'] },
          status: {
            type: 'string',
            enum: ['ongoing', 'completed', 'hiatus', 'cancelled'],
          },
          sourceWebsite: {
            oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/Website' }],
            description: 'Website id, or the populated website when the response expands it',
          },
          sourceUrl: { type: 'string', format: 'uri' },
          totalChapters: { type: 'integer', example: 179 },
          lastChapterAdded: { type: 'string', example: '179' },
          rating: { type: 'number', minimum: 0, maximum: 10 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ReadHistoryEntry: {
        type: 'object',
        description: 'One chapter a reader opened, newest first in the listing',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          manga: { $ref: '#/components/schemas/Manga' },
          userManga: { type: 'string', description: 'The library entry this reading belongs to' },
          chapter: { type: 'string', example: '194' },
          chapterUrl: { type: 'string', format: 'uri' },
          readAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserManga: {
        type: 'object',
        description: 'One series in a reader’s library, with their own progress and notes',
        properties: {
          _id: { type: 'string' },
          user: { type: 'string' },
          manga: { $ref: '#/components/schemas/Manga' },
          category: { $ref: '#/components/schemas/Category' },
          currentChapter: { type: 'string', example: '194', description: 'Supports half chapters, e.g. "45.5"' },
          totalChaptersRead: { type: 'integer' },
          progress: { type: 'integer', minimum: 0, maximum: 100 },
          lastReadUrl: { type: 'string', format: 'uri' },
          status: {
            type: 'string',
            enum: ['reading', 'plan-to-read', 'completed', 'on-hold', 'dropped'],
          },
          favorite: { type: 'boolean' },
          rating: { type: 'number', minimum: 0, maximum: 10 },
          notes: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          lastReadAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['Auth'],
        summary: 'Health check',
        description: 'Confirms the API is up. No authentication needed.',
        security: [],
        responses: {
          200: jsonResponse('The API is running', {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'UniManga  is running!' },
              status: { type: 'string', example: 'healthy' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          }),
        },
      },
    },

    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        description: 'Creates the account, seeds its default shelves, and returns a token.',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: { type: 'string', example: 'souvik' },
            email: { type: 'string', format: 'email', example: 'souvik@gmail.com' },
            password: { type: 'string', format: 'password', example: 'a-strong-password' },
          },
        }),
        responses: {
          201: jsonResponse('Account created', { $ref: '#/components/schemas/AuthResponse' }),
          400: errorResponse('The email or username is already taken'),
          500: errorResponse('Server error'),
        },
      },
    },

    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'souvik@gmail.com' },
            password: { type: 'string', format: 'password' },
          },
        }),
        responses: {
          200: jsonResponse('Signed in', { $ref: '#/components/schemas/AuthResponse' }),
          400: errorResponse('The password does not match'),
          404: errorResponse('No account with that email'),
          500: errorResponse('Server error'),
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the signed-in account',
        security: bearerAuth,
        responses: {
          200: jsonResponse('The current account', {
            allOf: [
              { $ref: '#/components/schemas/AuthUser' },
              {
