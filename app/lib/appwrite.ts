// lib/appwrite.ts
import { Client, Databases, Account, ID, Query } from 'appwrite';

const VITE_APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;
const VITE_APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
export const VITE_APPWRITE_DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

export const COLLECTION_ID_CHATS = import.meta.env.VITE_COLLECTION_ID_CHATS || 'chats';
export const COLLECTION_ID_SNAPSHOTS = import.meta.env.VITE_COLLECTION_ID_SNAPSHOTS || 'snapshots';
export const COLLECTION_ID_LOCKED_ITEMS = import.meta.env.VITE_COLLECTION_ID_LOCKED_ITEMS || 'lockedItems';

if (!VITE_APPWRITE_ENDPOINT || !VITE_APPWRITE_PROJECT_ID || !VITE_APPWRITE_DATABASE_ID) {
  console.error(
    'Appwrite environment variables are not set. Chat persistence with Appwrite will be disabled.',
  );
}

const client = new Client();

client
  .setEndpoint(VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1') // Votre Appwrite Endpoint
  .setProject(VITE_APPWRITE_PROJECT_ID || 'YOUR_PROJECT_ID'); // Votre Project ID

export const account = new Account(client);
export const databases = VITE_APPWRITE_ENDPOINT && VITE_APPWRITE_PROJECT_ID && VITE_APPWRITE_DATABASE_ID
  ? new Databases(client)
  : undefined;

export { ID, Query };

// Optionnel: Gérer une session anonyme si pas d'utilisateur connecté
export async function getAppwriteSession() {
  try {
    await account.get();
  } catch (error) {
    // Pas de session, créer une session anonyme
    try {
      await account.createAnonymousSession();
    } catch (anonError) {
      console.error('Failed to create anonymous session:', anonError);
      // Gérer l'échec de création de session anonyme (peut-être désactiver la persistance)
      throw anonError; // ou retourner une indication que la persistance est compromise
    }
  }
}

// Appeler getAppwriteSession au démarrage de l'application si la persistance est activée.
// Par exemple dans useChatHistory.ts ou dans un composant racine.
// if (databases) { // S'assurer que databases est initialisé
//   getAppwriteSession().catch(e => console.error("Appwrite session setup failed", e));
// }
