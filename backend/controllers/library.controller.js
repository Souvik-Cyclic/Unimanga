import mongoose from 'mongoose';
import UserManga from '../models/userManga.model.js';
import Manga from '../models/manga.model.js';
import Website from '../models/website.model.js';
import ReadHistory from '../models/readHistory.model.js';
import { recordRead } from './history.controller.js';

// Add manga to user's library
export const addMangaToLibrary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      // Either mangaId OR full metadata
      mangaId,
      title, 
      description, 
      author,
      artist, 
      coverImage,
      sourceWebsite, 
      sourceUrl,
      genres,
      mangaStatus,
      totalChapters,
      alternativeTitles,
      lastChapterAdded,
      rating,
      // Library fields
      categoryId,
      readingStatus,
      currentChapter,
      lastReadUrl
    } = req.body;

    let manga;

    // If mangaId is provided, fetch existing manga
    if (mangaId) {
      manga = await Manga.findById(mangaId);
      if (!manga) {
        return res.status(404).json({ message: 'Manga not found' });
      }
    } 
    // Otherwise, check by sourceUrl and create if needed
    else if (sourceUrl) {
      manga = await Manga.findOne({ sourceUrl });
      
      if (!manga) {
        // Auto-create manga entry
        if (!title || !sourceWebsite) {
          return res.status(400).json({ 
            message: 'title and sourceWebsite are required when creating new manga' 
          });
        }

        // If sourceWebsite is a string (website name), find the website ID
        let websiteId = sourceWebsite;
        if (typeof sourceWebsite === 'string' && !mongoose.Types.ObjectId.isValid(sourceWebsite)) {
          const website = await Website.findOne({ name: sourceWebsite });
          if (!website) {
            return res.status(400).json({ 
              message: `Website "${sourceWebsite}" not found. Please ensure the website exists in the database.` 
            });
          }
          websiteId = website._id;
        }

        manga = await Manga.create({
          title,
          description,
          author,
          artist,
          coverImage,
          sourceWebsite: websiteId,
          sourceUrl,
          genres: genres || [],
          status: mangaStatus || 'ongoing',
          totalChapters: totalChapters || 0,
          alternativeTitles: alternativeTitles || [],
          lastChapterAdded,
          rating,
        });
      }
    } 
    else {
      return res.status(400).json({ 
        message: 'Either mangaId or sourceUrl must be provided' 
      });
    }

    // Check if manga is already in user's library
    const existingEntry = await UserManga.findOne({
      user: userId,
      manga: manga._id,
    });

    if (existingEntry) {
      return res.status(400).json({ message: 'Manga already in your library' });
    }

    // Add to user's library
    const userManga = await UserManga.create({
      user: userId,
      manga: manga._id,
      category: categoryId,
      status: readingStatus || 'plan-to-read',
      startedAt: readingStatus === 'reading' ? new Date() : undefined,
      currentChapter: currentChapter || '0',
      lastReadUrl: lastReadUrl || sourceUrl,
      lastReadAt: new Date(),
    });

    const populatedUserManga = await UserManga.findById(userManga._id)
      .populate('manga')
      .populate('category');

    res.status(201).json({
      message: 'Manga added to library',
      userManga: populatedUserManga,
    });
  } catch (error) {
    console.error('Error in addMangaToLibrary:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Manga already in your library' });
    }
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: error.name 
    });
  }
};

// Get user's library with filters
export const getUserLibrary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { categoryId, status, favorite } = req.query;

    const filter = { user: userId };
    if (categoryId) filter.category = categoryId;
    if (status) filter.status = status;
    if (favorite === 'true') filter.favorite = true;

    const library = await UserManga.find(filter)
      .populate({
        path: 'manga',
        populate: {
          path: 'sourceWebsite',
          model: 'Website'
        }
      })
      .populate('category')
      .sort({ lastReadAt: -1, updatedAt: -1 });

    res.status(200).json({
      library,
      count: library.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update manga progress
export const updateMangaProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { currentChapter, totalChaptersRead, progress, status, chapterProgress, lastReadUrl } = req.body;

    const updateData = {
      lastReadAt: new Date(),
    };

    if (currentChapter !== undefined) updateData.currentChapter = currentChapter;
    if (totalChaptersRead !== undefined) updateData.totalChaptersRead = totalChaptersRead;
    if (progress !== undefined) updateData.progress = progress;
    if (lastReadUrl) updateData.lastReadUrl = lastReadUrl;
    if (status) {
      updateData.status = status;
      if (status === 'reading' && !updateData.startedAt) {
        updateData.startedAt = new Date();
      }
      if (status === 'completed') {
        updateData.completedAt = new Date();
        updateData.progress = 100;
      }
    }
    if (chapterProgress) updateData.chapterProgress = chapterProgress;

    const userManga = await UserManga.findOneAndUpdate(
      { _id: id, user: userId },
      updateData,
      { returnDocument: 'after' }
    )
      .populate('manga')
      .populate('category');

    if (!userManga) {
      return res.status(404).json({ message: 'Manga not found in library' });
    }

    // Saving progress is the moment a chapter counts as read, so the trail is
    // written here rather than asking every caller to record it separately.
    if (currentChapter !== undefined) {
      await recordRead({
        userId,
        mangaId: userManga.manga?._id ?? userManga.manga,
        userMangaId: userManga._id,
        chapter: currentChapter,
        chapterUrl: lastReadUrl ?? userManga.lastReadUrl,
      });
    }

    res.status(200).json({
      message: 'Progress updated',
      userManga,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update manga category
export const updateMangaCategory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { categoryId } = req.body;

    const userManga = await UserManga.findOneAndUpdate(
      { _id: id, user: userId },
      { category: categoryId },
      { returnDocument: 'after' }
    )
      .populate('manga')
      .populate('category');

    if (!userManga) {
      return res.status(404).json({ message: 'Manga not found in library' });
    }

    res.status(200).json({
      message: 'Category updated',
      userManga,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Toggle favorite
export const toggleFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const userManga = await UserManga.findOne({ _id: id, user: userId });
    
    if (!userManga) {
      return res.status(404).json({ message: 'Manga not found in library' });
    }

    userManga.favorite = !userManga.favorite;
    await userManga.save();

    await userManga.populate('manga');
    await userManga.populate('category');

    res.status(200).json({
      message: userManga.favorite ? 'Added to favorites' : 'Removed from favorites',
      userManga,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update rating and notes
export const updateMangaDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, notes } = req.body;

    const updateData = {};
    if (rating !== undefined) updateData.rating = rating;
    if (notes !== undefined) updateData.notes = notes;

    const userManga = await UserManga.findOneAndUpdate(
      { _id: id, user: userId },
      updateData,
      { returnDocument: 'after' }
    )
      .populate('manga')
      .populate('category');

    if (!userManga) {
      return res.status(404).json({ message: 'Manga not found in library' });
    }

    res.status(200).json({
      message: 'Details updated',
      userManga,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Remove manga from library
export const removeMangaFromLibrary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const userManga = await UserManga.findOneAndDelete({ _id: id, user: userId });

    if (!userManga) {
      return res.status(404).json({ message: 'Manga not found in library' });
    }

    // The reading trail describes a series the reader no longer tracks, so it
    // goes with it.
    await ReadHistory.deleteMany({ user: userId, manga: userManga.manga });

    res.status(200).json({
      message: 'Manga removed from library',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
