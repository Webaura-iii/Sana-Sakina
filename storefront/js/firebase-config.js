/**
 * Mirella Skin & Hair Care — Firebase Configuration
 * Project: mirella-glow
 */
const firebaseConfig = {
  apiKey: "AIzaSyDVuEPdIjJVXV9d0OyAiZMdjAe3pJoTfKU",
  authDomain: "mirella-glow.firebaseapp.com",
  projectId: "mirella-glow",
  storageBucket: "mirella-glow.firebasestorage.app",
  messagingSenderId: "624107590843",
  appId: "1:624107590843:web:1cf58fa7eda1533911859e"
};

if (typeof window !== 'undefined') {
  window.MIRELLA_FIREBASE_CONFIG = firebaseConfig;
  window.FIREBASE_CONFIG = firebaseConfig;
}
