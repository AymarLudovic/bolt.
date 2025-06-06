// chat.ts
import type { Message } from 'ai';
import type { IChatMetadata } from './db'; // Reste pareil
// Importer les fonctions d'Appwrite de db.ts si nécessaire ou les appeler directement
import { databases, VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, Query, ID, getAppwriteSession } from '~/lib/appwrite';
import { createScopedLogger } from '~/utils/logger'; // Si vous voulez du logging ici aussi

const logger = createScopedLogger('ChatAppwrite');

export interface Chat {
  id: string; // Correspond à chatId dans Appwrite
  appwriteDocumentId?: string; // ID du document Appwrite
  description?: string;
  messages: Message[];
  timestamp: string;
  urlId?: string;
  metadata?: IChatMetadata;
}

// Helper pour mapper un document Appwrite à Chat
function mapDocumentToChat(doc: any): Chat {
  return {
    id: doc.chatId,
    appwriteDocumentId: doc.$id,
    description: doc.description,
    messages: JSON.parse(doc.messages || '[]'),
    timestamp: doc.timestamp,
    urlId: doc.urlId,
    metadata: doc.metadata ? JSON.parse(doc.metadata) : undefined,
  };
}

export async function getAllChats(): Promise<Chat[]> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) {
    logger.warn('Appwrite not configured, cannot getAllChats.');
    return [];
  }
  await getAppwriteSession();
  console.log(`getAllChats: Using Appwrite database '${VITE_APPWRITE_DATABASE_ID}'`);
  try {
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_CHATS
      // [Query.limit(100)] // Ajouter pagination/filtres si besoin
    );
    const result = response.documents.map(mapDocumentToChat);
    console.log(`getAllChats: Found ${result.length} chats in Appwrite collection '${COLLECTION_ID_CHATS}'`);
    return result;
  } catch (err) {
    console.error(`getAllChats: Error querying Appwrite collection '${COLLECTION_ID_CHATS}':`, err);
    throw err;
  }
}

export async function getChatById(chatId: string): Promise<Chat | null> { // chatId est notre ID métier
  if (!databases || !VITE_APPWRITE_DATABASE_ID) return null;
  await getAppwriteSession();
  try {
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_CHATS,
      [Query.equal('chatId', chatId), Query.limit(1)]
    );
    if (response.documents.length > 0) {
      return mapDocumentToChat(response.documents[0]);
    }
    return null;
  } catch (error) {
    logger.error(`Error fetching chat by id ${chatId} from Appwrite:`, error);
    throw error;
  }
}

export async function saveChat(chat: Chat): Promise<string> { // Retourne l'ID du document Appwrite
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();

  const payload = {
    chatId: chat.id,
    description: chat.description || null,
    messages: JSON.stringify(chat.messages),
    timestamp: chat.timestamp || new Date().toISOString(),
    urlId: chat.urlId || null,
    metadata: chat.metadata ? JSON.stringify(chat.metadata) : null,
    // userId: (await account.get()).$id // Si lié à l'utilisateur
  };

  try {
    let doc;
    if (chat.appwriteDocumentId) { // Update
      doc = await databases.updateDocument(
        VITE_APPWRITE_DATABASE_ID,
        COLLECTION_ID_CHATS,
        chat.appwriteDocumentId,
        payload
      );
    } else { // Create or Update based on chatId (si chatId est unique et qu'on veut faire un upsert-like)
      const existing = await getChatById(chat.id);
      if (existing && existing.appwriteDocumentId) {
        doc = await databases.updateDocument(
          VITE_APPWRITE_DATABASE_ID,
          COLLECTION_ID_CHATS,
          existing.appwriteDocumentId,
          payload
        );
      } else {
        doc = await databases.createDocument(
          VITE_APPWRITE_DATABASE_ID,
          COLLECTION_ID_CHATS,
          ID.unique(), // Appwrite génère l'ID du document
          payload
        );
      }
    }
    return doc.$id;
  } catch (error) {
    logger.error(`Error saving chat ${chat.id} to Appwrite:`, error);
    throw error;
  }
}

// `id` ici est l'ID du document Appwrite, ou chatId si vous adaptez deleteById de db.ts
export async function deleteChat(appwriteDocumentId: string): Promise<void> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();
  try {
    // Note: deleteChat ne supprime pas les snapshots associés ici.
    // La fonction deleteById de db.ts est plus complète.
    // Vous pourriez vouloir appeler cette fonction à la place.
    // Exemple : const chat = await getChatByAppwriteDocId(appwriteDocumentId);
    // await dbDeleteById(appwriteDocumentId, chat.id /* chatId for snapshots */);
    await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, appwriteDocumentId);
  } catch (error) {
    logger.error(`Error deleting chat ${appwriteDocumentId} from Appwrite:`, error);
    throw error;
  }
}

export async function deleteAllChats(): Promise<void> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();
  try {
    // ATTENTION: Ceci supprime TOUS les documents. À utiliser avec précaution.
    // Appwrite SDK ne fournit pas de "clear collection". Il faut lister et supprimer.
    // Si les permissions le permettent, une fonction Appwrite serait plus efficace.
    logger.warn('Attempting to delete all chats. This can be slow and resource-intensive.');
    let documents = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, [Query.limit(100)]);
    while (documents.documents.length > 0) {
      for (const doc of documents.documents) {
        // Idéalement, supprimer aussi les snapshots associés
        // const snapshots = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, [Query.equal('chatDocumentId', doc.$id)]);
        // for (const snap of snapshots.documents) { await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, snap.$id); }
        await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, doc.$id);
      }
      if (documents.documents.length < 100) break; // Moins de 100, c'est la dernière page
      documents = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, [Query.limit(100), Query.cursorAfter(documents.documents[documents.documents.length -1].$id)]);
    }
    logger.info('All chats deleted (potentially).');
  } catch (error) {
    logger.error('Error deleting all chats from Appwrite:', error);
    throw error;
  }
}
