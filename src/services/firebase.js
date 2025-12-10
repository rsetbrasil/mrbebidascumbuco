import { initializeApp } from 'firebase/app';
import { initializeFirestore, setLogLevel, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

setLogLevel('silent');

// Check if config is valid
const isConfigured = firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'your_api_key_here';
const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const forceDemo = import.meta.env.VITE_USE_DEMO === 'true';
const enableAnonAuth = import.meta.env.VITE_ENABLE_ANON_AUTH === 'true';

export const isDemoMode = forceDemo || !isConfigured;

let app;
let db;
let analytics;
let auth;
let storage;

if (isConfigured && !isDemoMode) {
    try {
        app = initializeApp(firebaseConfig);
        db = initializeFirestore(app, {
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: false,
            useFetchStreams: false,
            ignoreUndefinedProperties: true
        });
        (async () => {
            try {
                await enableIndexedDbPersistence(db);
            } catch (err) {
                try {
                    await enableMultiTabIndexedDbPersistence(db);
                } catch {}
            }
        })();
        auth = getAuth(app);
        try {
            const bucket = String(firebaseConfig.storageBucket || '').toLowerCase();
            const bucketLooksValid = bucket.includes('appspot.com');
            if (bucketLooksValid) {
                storage = getStorage(app);
            } else {
                storage = undefined;
                console.warn('Firebase Storage desabilitado: storageBucket inválido. Use ".appspot.com" (ex: pdvmrbebidasantigravity.appspot.com)');
            }
        } catch {
            storage = undefined;
        }
        if (enableAnonAuth) {
            signInAnonymously(auth).catch(() => {});
        }
        if (import.meta.env.PROD && firebaseConfig.measurementId && !isLocalhost) {
            isSupported()
                .then((supported) => {
                    if (supported) {
                        analytics = getAnalytics(app);
                    }
                })
                .catch(() => {
                });
        }
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
} else {
    console.warn('Firebase config missing or invalid. Running in DEMO MODE.');
}

export { app, db, analytics, auth, storage };
export default app;
