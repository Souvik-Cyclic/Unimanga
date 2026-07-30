import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Website from '../models/website.model.js';

// Load environment variables
dotenv.config();

const websites = [

  // AsuraScans dropped - adapter never reliably extracted metadata, removed
  // from ExtractorFactory.ts. DB record deactivated (isActive:false) rather
  // than deleted, kept commented here in case it's revisited later.
  // {
  //   name: 'AsuraScans',
  //   url: 'https://asurascans.com',
  //   language: 'EN',
  //   color: '#8B5CF6',
  //   isActive: true
  // },
  {
    name: 'MangaFire', 
    url: 'https://mangafire.to', 
    language: 'EN', 
    color: '#FF6B35',
    isActive: true 
  },
  {
    name: 'WeebCentral',
    url: 'https://weebcentral.com',
    language: 'EN',
    color: '#9333EA',
    isActive: true
  },
  {
    name: 'Comizy',
    url: 'https://comizy.io',
    language: 'EN',
    color: '#10B981',
    isActive: true
  },
  {
    name: 'ManhuaPlus',
    url: 'https://manhuaplus.org',
    language: 'EN',
    color: '#EF4444',
    isActive: true
  },
  {
    name: 'MangaDex',
    url: 'https://mangadex.org',
    language: 'EN',
    color: '#FF6740',
    isActive: true
  },
  {
    name: 'MangaFreak',
    url: 'https://mangafreak.me',
    language: 'EN',
    color: '#22A6D9',
    isActive: true
  },
  {
    name: 'MangaTaro',
    url: 'https://mangataro.org',
    language: 'EN',
    color: '#F97316',
    isActive: true
  },
  {
    name: 'HiveToons',
    url: 'https://hivetoons.org',
    language: 'EN',
    color: '#EC4899',
    isActive: true
  }
]; // kept in sync with addWebsite.js's newWebsites list for fresh installs

const seedWebsites = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Clear existing websites (optional - remove this if you want to keep existing data)
    await Website.deleteMany({});
    console.log('Cleared existing websites');

    // Insert preconfigured websites
    const insertedWebsites = await Website.insertMany(websites);
    console.log(`Successfully seeded ${insertedWebsites.length} websites:`);
    insertedWebsites.forEach(site => {
      console.log(`   - ${site.name} (${site.url})`);
    });

    process.exit(0);
  } catch (error) {
    console.error(' Error seeding websites:', error.message);
    process.exit(1);
  }
};

// Run the seed function
seedWebsites();
