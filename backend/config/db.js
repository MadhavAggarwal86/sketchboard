require('dotenv').config();
const mongoose = require('mongoose');


const urrl = process.env.MONGODB_URI;

const connectToDatabase = async () => {
    try {
        await mongoose.connect(urrl);
        console.log('Connected to the database');
    } catch (err) {
        console.error(`Error connecting to the database: ${err}`);
    }
};

module.exports = connectToDatabase;