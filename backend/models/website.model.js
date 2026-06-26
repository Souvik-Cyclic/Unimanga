import mongoose from 'mongoose';

const websiteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  url: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: 'EN',
  },
  color: {
    type: String,
    default: '#6366F1',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const Website = mongoose.model('Website', websiteSchema);

export default Website;
