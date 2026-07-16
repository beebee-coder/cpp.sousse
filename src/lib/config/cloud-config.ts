export const cloudConfig = {
  postgresUrl: process.env.DATABASE_URL,
  apiEndpoint: process.env.NEXT_PUBLIC_API_URL || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'visionode-control.firebaseapp.com',
  syncRetryLimit: 3,
};
