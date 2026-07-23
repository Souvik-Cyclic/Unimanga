import mongoose from 'mongoose';

/**
 * One entry per chapter a reader opens. The library keeps only the latest
 * position for a series; this keeps the trail, so a reader can see what they
 * read last night and jump straight back to any of it.
 */
const readHistorySchema = new mongoose.Schema(
  {
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
    // The library entry this reading belongs to. Kept so history rows can open
    // straight back into progress tracking, and so removing a series from the
    // library can clear its trail.
    userManga: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserManga',
    },
    chapter: {
      type: String, // Chapter number or identifier (e.g. "95.5")
      required: true,
    },
    chapterUrl: {
      type: String, // Exact URL that was open when the chapter was recorded
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// The history list is always "this reader, newest first".
readHistorySchema.index({ user: 1, readAt: -1 });
// Re-reading the same chapter updates the existing row instead of stacking
// duplicates, so a reader scrolling back and forth does not flood the list.
readHistorySchema.index({ user: 1, manga: 1, chapter: 1 }, { unique: true });

const ReadHistory = mongoose.model('ReadHistory', readHistorySchema);

export default ReadHistory;
