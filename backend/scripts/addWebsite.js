import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Website from '../models/website.model.js';

// Non-destructive counterpart to seedWebsites.js - upserts by `name` instead
// of deleteMany()+insertMany(), so existing sites (and any data referencing
// them) are never wiped just to add one more.
dotenv.config();

const newWebsites = [
  {
    name: 'HiveToons',
    url: 'https://hivetoons.org',
    language: 'EN',
    color: '#EC4899',
    isActive: true
  }
];

const addWebsites = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    for (const site of newWebsites) {
      const result = await Website.findOneAndUpdate(
        { name: site.name },
        { $set: site },
        { upsert: true, new: true }
      );
      console.log(`   - ${result.name} (${result.url})`);
    }

    console.log(`Done: ${newWebsites.length} website(s) added/updated`);
    process.exit(0);
  } catch (error) {
    console.error('Error adding websites:', error.message);
    process.exit(1);
  }
};

addWebsites();
