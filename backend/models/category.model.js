import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  color: {
    type: String,
    default: '#6366F1', // Default indigo color
  },
  icon: {
    type: String, // Optional emoji or icon identifier
  },
  order: {
    type: Number, // For custom ordering
    default: 0,
  },
  isDefault: {
    type: Boolean,
    default: false, // For system categories like "Reading", "Plan to Read"
  },
}, {
  timestamps: true,
});

// Ensure user can't have duplicate category names
categorySchema.index({ user: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;
