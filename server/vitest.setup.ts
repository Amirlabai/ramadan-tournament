process.env.MOCK_DEV_DATA = '1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';
process.env.PERSONAL_ID_KEY =
  process.env.PERSONAL_ID_KEY || Buffer.alloc(32, 7).toString('base64');
