import express from 'express';
import {
  addHistoryEntry,
  getHistory,
  deleteHistoryEntry,
  clearHistory,
} from '../controllers/history.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// A reading trail belongs to one account, so every route needs a token.
router.use(authMiddleware);

router.get('/', getHistory);
router.post('/', addHistoryEntry);
router.delete('/', clearHistory);
router.delete('/:id', deleteHistoryEntry);

export default router;
