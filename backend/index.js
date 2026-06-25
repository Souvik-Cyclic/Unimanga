import dotenv from 'dotenv';
import connectDB from './config/dbConfig.js';
import app from './app.js';

dotenv.config();

connectDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`)
})
