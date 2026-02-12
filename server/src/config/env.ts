import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGODB_URI || '',
    jwtSecret: process.env.JWT_SECRET || '',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required environment variables
if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required');
}

if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is required');
}
