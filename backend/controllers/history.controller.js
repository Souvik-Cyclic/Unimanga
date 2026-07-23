import ReadHistory from '../models/readHistory.model.js';

/**
 * Record that a chapter was read. Re-reading the same chapter moves it back to
 * the top of the list rather than adding a second row.
 *
 * Called by the library controller whenever progress is saved, and exposed
 * directly so the reader screen can record a chapter it opened.
 */
export const recordRead = async ({ userId, mangaId, userMangaId, chapter, chapterUrl }) => {
  if (!userId || !mangaId || chapter === undefined || chapter === null) return null;

  const normalized = String(chapter).trim();
  // "0" is the placeholder for a series that has not been started; there is
  // nothing to record until a real chapter is opened.
  if (normalized === '' || normalized === '0') return null;

  return ReadHistory.findOneAndUpdate(
    { user: userId, manga: mangaId, chapter: normalized },
    {
      $set: {
        user: userId,
        manga: mangaId,
        chapter: normalized,
        readAt: new Date(),
        ...(userMangaId ? { userManga: userMangaId } : {}),
        ...(chapterUrl ? { chapterUrl } : {}),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

/** POST /api/history — record a chapter read from the reader screen. */
export const addHistoryEntry = async (req, res) => {
  try {
    const { mangaId, userMangaId, chapter, chapterUrl } = req.body;

    if (!mangaId || !chapter) {
      return res.status(400).json({ message: 'mangaId and chapter are required' });
    }

    const entry = await recordRead({
      userId: req.user.id,
      mangaId,
      userMangaId,
      chapter,
      chapterUrl,
    });

    if (!entry) {
      return res.status(400).json({ message: 'Nothing to record for that chapter' });
    }

