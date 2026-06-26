import mongoose from 'mongoose';

const mangaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  alternativeTitles: [{
    type: String,
  }],
  description: {
    type: String,
  },
  author: {
    type: String,
  },
  artist: {
    type: String,
  },
  coverImage: {
    type: String, // URL to cover image
  },
  genres: [{
    type: String,
  }],
  status: {
    type: String,
    enum: ['ongoing', 'completed', 'hiatus', 'cancelled'],
    default: 'ongoing',
  },
  sourceWebsite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true,
  },
  sourceUrl: {
    type: String, // Direct URL to manga on source website
    required: true,
  },
  totalChapters: {
    type: Number,
    default: 0,
  },
  lastChapterAdded: {
    type: String,
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
  },
}, {
  timestamps: true,
});

// Index for faster searches
mangaSchema.index({ title: 'text', description: 'text' });
mangaSchema.index({ sourceWebsite: 1 });

const Manga = mongoose.model('Manga', mangaSchema);

export default Manga;
