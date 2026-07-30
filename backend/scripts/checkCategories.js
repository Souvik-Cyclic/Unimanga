import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/category.model.js';
import User from '../models/user.model.js';

// Load environment variables
dotenv.config();

async function checkCategories() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find test user
    const user = await User.findOne({ email: 'user1@gmail.com' });
    if (!user) {
      console.log('❌ Test user not found');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('✅ Found user:', user.email);

    // Check categories
    const categories = await Category.find({ user: user._id });
    console.log('\n📊 Categories found:', categories.length);
    
    if (categories.length > 0) {
      console.log('\n📁 Categories:');
      categories.forEach(cat => {
        console.log(`  - ${cat.name} (${cat.icon}) [${cat.color}]`);
      });
    } else {
      console.log('\n⚠️  No categories found! Creating default categories...');
      
      const defaultCategories = [
        { name: 'Reading', icon: '📖', color: '#10b981', order: 1, isDefault: true },
        { name: 'Plan to Read', icon: '📝', color: '#3b82f6', order: 2, isDefault: true },
        { name: 'Completed', icon: '✅', color: '#8b5cf6', order: 3, isDefault: true },
        { name: 'On Hold', icon: '⏸️', color: '#f59e0b', order: 4, isDefault: true },
        { name: 'Dropped', icon: '❌', color: '#ef4444', order: 5, isDefault: true },
      ];

      for (const catData of defaultCategories) {
        await Category.create({ ...catData, user: user._id });
      }

      console.log('✅ Created 5 default categories');
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkCategories();
