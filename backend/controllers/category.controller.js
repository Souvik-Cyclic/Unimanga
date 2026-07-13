import Category from '../models/category.model.js';

// Create a new category
export const createCategory = async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    const userId = req.user.id; // From JWT middleware

    const category = await Category.create({
      name,
      user: userId,
      color: color || '#6366F1',
      icon,
    });

    res.status(201).json({
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all categories for a user
export const getCategories = async (req, res) => {
  try {
    const userId = req.user.id;

    const categories = await Category.find({ user: userId }).sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      categories,
      count: categories.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon, order } = req.body;
    const userId = req.user.id;

    const category = await Category.findOneAndUpdate(
      { _id: id, user: userId },
      { name, color, icon, order },
