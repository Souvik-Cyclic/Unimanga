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
      { returnDocument: 'after', runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({
      message: 'Category updated successfully',
      category,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const category = await Category.findOneAndDelete({ _id: id, user: userId });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({
      message: 'Category deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Initialize default categories for new users
export const initializeDefaultCategories = async (userId) => {
  const defaultCategories = [
    { name: 'Reading', color: '#10B981', icon: '📖', order: 1, isDefault: true },
    { name: 'Plan to Read', color: '#3B82F6', icon: '📚', order: 2, isDefault: true },
    { name: 'Completed', color: '#8B5CF6', icon: '✅', order: 3, isDefault: true },
    { name: 'On Hold', color: '#F59E0B', icon: '⏸️', order: 4, isDefault: true },
    { name: 'Dropped', color: '#EF4444', icon: '❌', order: 5, isDefault: true },
  ];

  try {
    const categories = defaultCategories.map(cat => ({ ...cat, user: userId }));
    await Category.insertMany(categories);
  } catch (error) {
    console.error('Error initializing default categories:', error);
  }
};
