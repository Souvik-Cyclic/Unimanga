import express from 'express';
import {
  createManga,
  getAllManga,
  getMangaById,
  updateManga,
  deleteManga,
} from '../controllers/manga.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllManga);
router.get('/:id', getMangaById);

// Protected routes (admin only - disabled for regular users)
// Regular users cannot create manga directly
// Manga creation happens automatically via library.controller.js addMangaToLibrary()
// router.post('/', authMiddleware, createManga);
// router.put('/:id', authMiddleware, updateManga);
// router.delete('/:id', authMiddleware, deleteManga);

export default router;
