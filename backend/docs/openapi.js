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
                type: 'object',
                properties: { createdAt: { type: 'string', format: 'date-time' } },
              },
            ],
          }),
          401: errorResponse('Missing or invalid token'),
          404: errorResponse('Account no longer exists'),
        },
      },
    },

    '/api/auth/profile': {
      put: {
        tags: ['Auth'],
        summary: 'Update username or email',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        }),
        responses: {
          200: jsonResponse('Profile updated', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              user: { $ref: '#/components/schemas/AuthUser' },
            },
          }),
          400: errorResponse('That username or email is already in use'),
          401: errorResponse('Missing or invalid token'),
        },
      },
    },

    '/api/auth/password': {
      put: {
        tags: ['Auth'],
        summary: 'Change the password',
        description: 'Requires the current password; the new one is stored as a bcrypt hash.',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', format: 'password' },
            newPassword: { type: 'string', format: 'password' },
          },
        }),
        responses: {
          200: jsonResponse('Password updated', { $ref: '#/components/schemas/Error' }),
          400: errorResponse('The current password is incorrect'),
          401: errorResponse('Missing or invalid token'),
        },
      },
    },

    '/api/auth/account': {
      delete: {
        tags: ['Auth'],
        summary: 'Delete the account',
        description:
          'Permanently removes the account along with its shelves and library entries. ' +
          'Confirm with the account password.',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          required: ['password'],
          properties: { password: { type: 'string', format: 'password' } },
        }),
        responses: {
          200: jsonResponse('Account deleted', { $ref: '#/components/schemas/Error' }),
          400: errorResponse('The password is incorrect'),
          401: errorResponse('Missing or invalid token'),
        },
      },
    },

    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List your shelves',
        security: bearerAuth,
        responses: {
          200: jsonResponse('Shelves, in display order', {
            type: 'object',
            properties: {
              categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
            },
          }),
          401: errorResponse('Missing or invalid token'),
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create a shelf',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Weekly' },
            color: { type: 'string', example: '#6366F1' },
            icon: { type: 'string', example: '📚' },
            order: { type: 'integer' },
          },
        }),
        responses: {
          201: jsonResponse('Shelf created', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              category: { $ref: '#/components/schemas/Category' },
            },
          }),
          400: errorResponse('You already have a shelf with that name'),
          401: errorResponse('Missing or invalid token'),
        },
      },
    },

    '/api/categories/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Shelf id' },
      ],
      put: {
        tags: ['Categories'],
        summary: 'Rename or restyle a shelf',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            name: { type: 'string' },
            color: { type: 'string' },
            icon: { type: 'string' },
            order: { type: 'integer' },
          },
        }),
        responses: {
          200: jsonResponse('Shelf updated', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              category: { $ref: '#/components/schemas/Category' },
            },
          }),
          404: errorResponse('No such shelf'),
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete a shelf',
        security: bearerAuth,
        responses: {
          200: jsonResponse('Shelf deleted', { $ref: '#/components/schemas/Error' }),
          404: errorResponse('No such shelf'),
        },
      },
    },

    '/api/library': {
      get: {
        tags: ['Library'],
        summary: 'List your tracked series',
        description: 'Newest reading activity first. Filters combine.',
        security: bearerAuth,
        parameters: [
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Only series on this shelf',
          },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['reading', 'plan-to-read', 'completed', 'on-hold', 'dropped'],
            },
          },
          { name: 'favorite', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: jsonResponse('Your library', {
            type: 'object',
            properties: {
              library: { type: 'array', items: { $ref: '#/components/schemas/UserManga' } },
              count: { type: 'integer' },
            },
          }),
          401: errorResponse('Missing or invalid token'),
        },
      },
      post: {
        tags: ['Library'],
        summary: 'Add a series to your library',
        description:
          'Pass `mangaId` for a series already in the catalogue, or the series details ' +
          '(`title`, `sourceUrl`, `sourceWebsite`) to have it created on the way in.',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          required: ['categoryId'],
          properties: {
            mangaId: { type: 'string', description: 'Existing catalogue entry' },
            title: { type: 'string', example: 'Solo Leveling' },
            description: { type: 'string' },
            author: { type: 'string' },
            artist: { type: 'string' },
            coverImage: { type: 'string', format: 'uri' },
            sourceWebsite: { type: 'string', description: 'Website id or name' },
            sourceUrl: { type: 'string', format: 'uri' },
            genres: { type: 'array', items: { type: 'string' } },
            mangaStatus: {
              type: 'string',
              enum: ['ongoing', 'completed', 'hiatus', 'cancelled'],
            },
            totalChapters: { type: 'integer' },
            alternativeTitles: { type: 'array', items: { type: 'string' } },
            lastChapterAdded: { type: 'string' },
            rating: { type: 'number' },
            categoryId: { type: 'string' },
            readingStatus: {
              type: 'string',
              enum: ['reading', 'plan-to-read', 'completed', 'on-hold', 'dropped'],
            },
            currentChapter: { type: 'string', example: '1' },
            lastReadUrl: { type: 'string', format: 'uri' },
          },
        }),
        responses: {
          201: jsonResponse('Added', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              userManga: { $ref: '#/components/schemas/UserManga' },
            },
          }),
          400: errorResponse('Missing details, or the series is already in your library'),
          404: errorResponse('No such manga'),
        },
      },
    },

    '/api/library/{id}/progress': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Library entry id' },
      ],
      put: {
        tags: ['Library'],
        summary: 'Save reading progress',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            currentChapter: { type: 'string', example: '195' },
            totalChaptersRead: { type: 'integer' },
            progress: { type: 'integer', minimum: 0, maximum: 100 },
            status: {
              type: 'string',
              enum: ['reading', 'plan-to-read', 'completed', 'on-hold', 'dropped'],
            },
            lastReadUrl: { type: 'string', format: 'uri' },
            chapterProgress: {
              type: 'object',
              properties: {
                scrollPosition: { type: 'number' },
                pageNumber: { type: 'integer' },
              },
            },
          },
        }),
        responses: {
          200: jsonResponse('Progress saved', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              userManga: { $ref: '#/components/schemas/UserManga' },
            },
          }),
          404: errorResponse('That series is not in your library'),
        },
      },
    },

    '/api/library/{id}/category': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Library entry id' },
      ],
      put: {
        tags: ['Library'],
        summary: 'Move a series to another shelf',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          required: ['categoryId'],
          properties: { categoryId: { type: 'string' } },
        }),
        responses: {
          200: jsonResponse('Moved', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              userManga: { $ref: '#/components/schemas/UserManga' },
            },
          }),
          404: errorResponse('That series is not in your library'),
        },
      },
    },

    '/api/library/{id}/favorite': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Library entry id' },
      ],
      put: {
        tags: ['Library'],
        summary: 'Toggle favourite',
        security: bearerAuth,
        responses: {
          200: jsonResponse('Favourite flipped', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              userManga: { $ref: '#/components/schemas/UserManga' },
            },
          }),
          404: errorResponse('That series is not in your library'),
        },
      },
    },

    '/api/library/{id}/details': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Library entry id' },
      ],
      put: {
        tags: ['Library'],
        summary: 'Set your rating and notes',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            rating: { type: 'number', minimum: 0, maximum: 10 },
            notes: { type: 'string' },
          },
        }),
        responses: {
          200: jsonResponse('Saved', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              userManga: { $ref: '#/components/schemas/UserManga' },
            },
          }),
          404: errorResponse('That series is not in your library'),
        },
      },
    },

    '/api/library/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Library entry id' },
      ],
      delete: {
        tags: ['Library'],
        summary: 'Remove a series from your library',
        description: 'Clears your progress for it. The catalogue entry itself is kept.',
        security: bearerAuth,
        responses: {
          200: jsonResponse('Removed', { $ref: '#/components/schemas/Error' }),
          404: errorResponse('That series is not in your library'),
        },
      },
    },

    '/api/history': {
      get: {
        tags: ['History'],
        summary: 'List what you have read',
        description:
          'Newest first. Entries are written whenever reading progress is saved, ' +
          'and re-reading a chapter moves it back to the top rather than duplicating it.',
        security: bearerAuth,
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50, maximum: 200 },
            description: 'How many entries to return',
          },
          {
            name: 'skip',
            in: 'query',
            schema: { type: 'integer', default: 0 },
            description: 'How many entries to skip, for paging',
          },
        ],
        responses: {
          200: jsonResponse('Your reading trail', {
            type: 'object',
            properties: {
              history: {
                type: 'array',
                items: { $ref: '#/components/schemas/ReadHistoryEntry' },
              },
              count: { type: 'integer', description: 'Entries in this page' },
              total: { type: 'integer', description: 'Entries you have in total' },
            },
          }),
          401: errorResponse('Missing or invalid token'),
        },
      },
      post: {
        tags: ['History'],
        summary: 'Record a chapter as read',
        description:
          'Saving progress records history on its own; use this when a chapter is ' +
          'opened without a progress save.',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          required: ['mangaId', 'chapter'],
          properties: {
            mangaId: { type: 'string' },
            userMangaId: { type: 'string' },
            chapter: { type: 'string', example: '194' },
            chapterUrl: { type: 'string', format: 'uri' },
          },
        }),
        responses: {
          201: jsonResponse('Reading recorded', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              entry: { $ref: '#/components/schemas/ReadHistoryEntry' },
            },
          }),
          400: errorResponse('mangaId and chapter are required, or the chapter was a placeholder'),
          401: errorResponse('Missing or invalid token'),
        },
      },
      delete: {
        tags: ['History'],
        summary: 'Clear your whole reading trail',
        description: 'Your library and progress are untouched; only the trail is erased.',
        security: bearerAuth,
        responses: {
          200: jsonResponse('History cleared', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              removed: { type: 'integer' },
            },
          }),
          401: errorResponse('Missing or invalid token'),
        },
      },
    },

    '/api/history/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'History entry id' },
      ],
      delete: {
        tags: ['History'],
        summary: 'Remove one entry from your trail',
        security: bearerAuth,
        responses: {
          200: jsonResponse('Entry removed', { $ref: '#/components/schemas/Error' }),
          404: errorResponse('No such entry'),
        },
      },
    },

    '/api/manga': {
      get: {
        tags: ['Manga'],
        summary: 'Browse the catalogue',
        security: [],
        responses: {
          200: jsonResponse('Catalogue entries', {
            type: 'object',
            properties: {
              manga: { type: 'array', items: { $ref: '#/components/schemas/Manga' } },
              count: { type: 'integer' },
            },
          }),
        },
      },
    },

    '/api/manga/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Manga id' },
      ],
      get: {
        tags: ['Manga'],
        summary: 'Get one series',
        security: [],
        responses: {
          200: jsonResponse('The series', {
            type: 'object',
            properties: { manga: { $ref: '#/components/schemas/Manga' } },
          }),
          404: errorResponse('No such manga'),
        },
      },
    },

    '/api/websites': {
      get: {
        tags: ['Websites'],
        summary: 'List the sources readers can browse',
        security: [],
        responses: {
          200: jsonResponse('Sources', {
            type: 'object',
            properties: {
              websites: { type: 'array', items: { $ref: '#/components/schemas/Website' } },
            },
          }),
        },
      },
      post: {
        tags: ['Websites'],
        summary: 'Add a source',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          required: ['name', 'url'],
          properties: {
            name: { type: 'string', example: 'AsuraScans' },
            url: { type: 'string', format: 'uri' },
            language: { type: 'string', example: 'EN' },
            color: { type: 'string', example: '#8B5CF6' },
            isActive: { type: 'boolean' },
          },
        }),
        responses: {
          201: jsonResponse('Source added', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              website: { $ref: '#/components/schemas/Website' },
            },
          }),
          400: errorResponse('A source with that name already exists'),
          401: errorResponse('Missing or invalid token'),
        },
      },
    },

    '/api/websites/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Website id' },
      ],
      put: {
        tags: ['Websites'],
        summary: 'Update a source',
        security: bearerAuth,
        requestBody: jsonBody({
          type: 'object',
          properties: {
            name: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            language: { type: 'string' },
            color: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        }),
        responses: {
          200: jsonResponse('Source updated', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              website: { $ref: '#/components/schemas/Website' },
            },
          }),
          404: errorResponse('No such source'),
        },
      },
      delete: {
        tags: ['Websites'],
        summary: 'Delete a source',
        security: bearerAuth,
        responses: {
          200: jsonResponse('Source deleted', { $ref: '#/components/schemas/Error' }),
          404: errorResponse('No such source'),
        },
      },
    },
  },
};

export default openApiSpec;
