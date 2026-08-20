import Manga from '../models/manga.model.js';
import Website from '../models/website.model.js';

// Create a new manga entry
export const createManga = async (req, res) => {
  try {
    const {
      title,
      alternativeTitles,
      description,
      author,
      artist,
      coverImage,
      genres,
      status,
      sourceWebsite,
      sourceUrl,
      totalChapters,
      rating,
    } = req.body;

    const manga = await Manga.create({
      title,
      alternativeTitles,
      description,
      author,
      artist,
      coverImage,
      genres,
      status,
      sourceWebsite,
      sourceUrl,
      totalChapters,
      rating,
    });

    const populatedManga = await Manga.findById(manga._id).populate('sourceWebsite');

    res.status(201).json({
      message: 'Manga created successfully',
      manga: populatedManga,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all manga (with pagination and filters)
export const getAllManga = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sourceWebsite, status, genre } = req.query;

    const filter = {};
    if (sourceWebsite) filter.sourceWebsite = sourceWebsite;
    if (status) filter.status = status;
    if (genre) filter.genres = genre;
    if (search) {
      filter.$text = { $search: search };
    }

    const manga = await Manga.find(filter)
      .populate('sourceWebsite')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Manga.countDocuments(filter);

    res.status(200).json({
      manga,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalManga: count,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get manga by ID
export const getMangaById = async (req, res) => {
  try {
    const { id } = req.params;

    const manga = await Manga.findById(id).populate('sourceWebsite');

    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    res.status(200).json({ manga });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update manga
export const updateManga = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const manga = await Manga.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('sourceWebsite');

    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    res.status(200).json({
      message: 'Manga updated successfully',
      manga,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete manga
export const deleteManga = async (req, res) => {
  try {
    const { id } = req.params;

    const manga = await Manga.findByIdAndDelete(id);

    if (!manga) {
      return res.status(404).json({ message: 'Manga not found' });
    }

    res.status(200).json({
      message: 'Manga deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
