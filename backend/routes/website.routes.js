import express from 'express';
import {
  createWebsite,
  getWebsites,
  updateWebsite,
  deleteWebsite,
} from '../controllers/website.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public route
router.get('/', getWebsites);

// Protected routes (admin only)
router.post('/', authMiddleware, createWebsite);
router.put('/:id', authMiddleware, updateWebsite);
router.delete('/:id', authMiddleware, deleteWebsite);

export default router;
