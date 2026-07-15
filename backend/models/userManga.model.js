import mongoose from 'mongoose';

const userMangaSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  manga: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manga',
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  currentChapter: {
    type: String, // Chapter number or identifier (e.g., "95.5")
    default: '0',
  },
  totalChaptersRead: {
    type: Number,
    default: 0,
  },
  progress: {
    type: Number, // Percentage (0-100)
    default: 0,
  },
  lastReadUrl: {
    type: String, // Exact URL where user was reading
  },
  status: {
    type: String,
    enum: ['reading', 'completed', 'on-hold', 'dropped', 'plan-to-read'],
    default: 'plan-to-read',
  },
  rating: {
    type: Number, // User's personal rating (0-10)
    min: 0,
    max: 10,
  },
  favorite: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: String, // User's personal notes about the manga
  },
  lastReadAt: {
    type: Date,
  },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  // For tracking reading position within a chapter
  chapterProgress: {
    scrollPosition: Number,
    pageNumber: Number,
  },
}, {
  timestamps: true,
});

// Ensure user can't add same manga twice
userMangaSchema.index({ user: 1, manga: 1 }, { unique: true });

// Index for faster queries
userMangaSchema.index({ user: 1, category: 1 });
userMangaSchema.index({ user: 1, status: 1 });
userMangaSchema.index({ user: 1, favorite: 1 });
userMangaSchema.index({ user: 1, lastReadAt: -1 });

const UserManga = mongoose.model('UserManga', userMangaSchema);

export default UserManga;
