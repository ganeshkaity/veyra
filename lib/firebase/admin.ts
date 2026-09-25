import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function formatPrivateKey(key?: string) {
  if (!key) return undefined;
  return key.replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp(): App {
  const currentApps = getApps();
  if (currentApps.length > 0) {
    return currentApps[0]!;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  // Fallback to default application credentials if running in Google Cloud or test mode
  return initializeApp();
}

export const getAdminAuth = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth");
  return getAuth(getFirebaseAdminApp());
};
export const getAdminFirestore = () => getFirestore(getFirebaseAdminApp());
