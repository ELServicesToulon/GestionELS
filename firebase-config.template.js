/**
 * Firebase configuration template for the GestionELS PWA.
 * Copy to `firebase-config.js` in the same directory as the PWA bundle
 * (see README.md > Intégration Firebase Web) and replace the placeholders
 * with the Web App settings from the Firebase console.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyYourKey',                 // Mirrors FIREBASE_API_KEY in .env.template
  authDomain: 'els-services-littoral.firebaseapp.com', // Optional auth domain used by Firebase Hosting/Auth
  projectId: 'els-services-littoral',      // Maps to Configuration.gs > CFG_FIREBASE_PROJECT_ID
  storageBucket: 'els-services-littoral.appspot.com', // Drive bucket for uploads (if used)
  messagingSenderId: '1234567890',         // Aligns with FIREBASE_SENDER_ID and FcmService.gs usage
  appId: '1:1234567890:web:abcdef123456',  // Aligns with FIREBASE_APP_ID for Web App registration
  measurementId: 'G-XXXXXXXXXX'            // Optional: enable if Google Analytics is activated
};

/**
 * Optionally export helper functions when the bundler expects named exports.
 * Keep secrets out of source control—only publish placeholders here.
 */
export function getFirebaseConfig() {
  return firebaseConfig;
}
