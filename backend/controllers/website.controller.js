import Website from '../models/website.model.js';

// Create a new website
export const createWebsite = async (req, res) => {
  try {
    const { name, url, language, color } = req.body;

    const website = await Website.create({
      name,
      url,
      language,
      color,
    });

    res.status(201).json({
      message: 'Website created successfully',
      website,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Website already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all websites
export const getWebsites = async (req, res) => {
  try {
    const { isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const websites = await Website.find(filter).sort({ name: 1 });

    res.status(200).json({
      websites,
      count: websites.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update website
export const updateWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const website = await Website.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    res.status(200).json({
      message: 'Website updated successfully',
      website,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete website
export const deleteWebsite = async (req, res) => {
  try {
    const { id } = req.params;

    const website = await Website.findByIdAndDelete(id);

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    res.status(200).json({
      message: 'Website deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
