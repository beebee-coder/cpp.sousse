export const cloudConfig = {
  postgresUrl: process.env.DATABASE_URL || 'postgresql://neondb_owner:mock@ep-mock-pool.us-east-2.neon.tech/neondb',
  apiEndpoint: process.env.NEXT_PUBLIC_API_URL || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'visionode-control.firebaseapp.com',
  syncRetryLimit: 3,
};
