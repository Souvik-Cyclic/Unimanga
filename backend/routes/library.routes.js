import express from 'express';
import {
  addMangaToLibrary,
  getUserLibrary,
  updateMangaProgress,
  updateMangaCategory,
  toggleFavorite,
  updateMangaDetails,
  removeMangaFromLibrary,
} from '../controllers/library.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/', addMangaToLibrary);
router.get('/', getUserLibrary);
router.put('/:id/progress', updateMangaProgress);
router.put('/:id/category', updateMangaCategory);
router.put('/:id/favorite', toggleFavorite);
router.put('/:id/details', updateMangaDetails);
router.delete('/:id', removeMangaFromLibrary);

export default router;
