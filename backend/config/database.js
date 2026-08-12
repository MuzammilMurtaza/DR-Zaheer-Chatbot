const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
    try {
        // Disable Mongoose command buffering so queries fail-fast when DB is offline
        mongoose.set('bufferCommands', false);

        const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mza_clinic_db';
        const conn = await mongoose.connect(connStr, {
            serverSelectionTimeoutMS: 2000
        });

        isConnected = true;
        console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
        return true;
    } catch (error) {
        isConnected = false;
        console.warn(`[Database] Connection Note: ${error.message}`);
        console.warn('[Database] Active with Instant Fallback Store.');
        return false;
    }
};

const getDBStatus = () => {
    return isConnected && mongoose.connection && mongoose.connection.readyState === 1;
};

module.exports = { connectDB, getDBStatus };
