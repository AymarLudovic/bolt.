// db.ts
import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot } from './types';
import {
  databases,
  ID,
  Query,
  VITE_APPWRITE_DATABASE_ID,
  COLLECTION_ID_CHATS,
  COLLECTION_ID_SNAPSHOTS,
  getAppwriteSession, // Importé pour s'assurer qu'une session existe
} from '~/lib/appwrite'; // Ajustez le chemin

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('ChatHistoryAppwrite');

// Helper pour mapper un document Appwrite à ChatHistoryItem
// db.ts
// ...

// Helper pour mapper un document Appwrite à ChatHistoryItem
function mapDocumentToChatHistoryItem(doc: any): ChatHistoryItem {
  if (!doc || !doc.chatId) {
    logger.error("db.ts: mapDocumentToChatHistoryItem - Document or doc.chatId is missing", doc);
    // Il est préférable de ne pas retourner d'item invalide, ou de lancer une erreur qui sera attrapée
    // Pour l'instant, on pourrait retourner un objet partiel si l'ID existe,
    // mais cela pourrait causer des problèmes en aval. Mieux vaut filtrer plus tard ou lancer une erreur.
    // throw new Error("Invalid document structure from Appwrite for chat item.");
    // Ou, si on veut quand même essayer de le traiter mais qu'il sera probablement filtré :
    return {
        id: doc.chatId || 'unknown-id-' + Date.now(),
        appwriteDocumentId: doc.$id || 'unknown-appwrite-id',
        urlId: doc.urlId || undefined, // undefined si null/vide
        description: 'Untitled Chat (data error)', // Placeholder clair
        messages: [],
        timestamp: new Date().toISOString(),
        metadata: undefined
    } as ChatHistoryItem; // Assertion de type si on retourne un objet partiel mais conforme
  }
  try {
    const messages = JSON.parse(doc.messages || '[]');
    const metadata = doc.metadata ? JSON.parse(doc.metadata) : undefined;

    // FOURNIR UNE DESCRIPTION PAR DÉFAUT SI CELLE D'APPWRITE EST NULL OU VIDE
    let descriptionToUse = doc.description;
    if (!descriptionToUse?.trim()) { // Si null, undefined, ou chaîne vide après trim
        // Utiliser une partie de l'ID du chat ou une date comme fallback
        descriptionToUse = `Chat ${doc.chatId.substring(0, 8)} - ${new Date(doc.timestamp || Date.now()).toLocaleDateString()}`;
        logger.warn(`db.ts: mapDocumentToChatHistoryItem - Document ${doc.$id} (chatId: ${doc.chatId}) has null/empty description. Using default: "${descriptionToUse}"`);
    }

    // S'assurer que urlId est undefined s'il est vide, pour le filtre `!!item.urlId`
    const urlIdToUse = doc.urlId?.trim() ? doc.urlId.trim() : undefined;
    if (doc.urlId && !urlIdToUse) {
        logger.warn(`db.ts: mapDocumentToChatHistoryItem - Document ${doc.$id} (chatId: ${doc.chatId}) has empty urlId. Setting to undefined.`);
    }


    return {
      id: doc.chatId,
      appwriteDocumentId: doc.$id,
      urlId: urlIdToUse,
      description: descriptionToUse, // Utiliser la description (potentiellement par défaut)
      messages: messages as Message[],
      timestamp: doc.timestamp,
      metadata: metadata,
    };
  } catch (e) {
    logger.error(`db.ts: mapDocumentToChatHistoryItem - JSON parsing or other error for doc $id ${doc.$id}, chatId ${doc.chatId}:`, e, "Raw doc:", doc);
    // En cas d'erreur de parsing critique, on pourrait retourner un objet placeholder ou lancer plus haut
    return {
        id: doc.chatId,
        appwriteDocumentId: doc.$id,
        urlId: doc.urlId || undefined,
        description: `Error loading chat ${doc.chatId.substring(0,8)}`,
        messages: [],
        timestamp: doc.timestamp || new Date().toISOString(),
        metadata: undefined,
    } as ChatHistoryItem;
  }
}

// Helper pour mapper un document Appwrite à Snapshot
function mapDocumentToSnapshot(doc: any): Snapshot | undefined {
    if (!doc) return undefined;
    return {
        chatIndex: doc.chatIndex,
        files: JSON.parse(doc.files || '{}'),
        summary: doc.summary,
        // On pourrait ajouter appwriteDocumentId ici si nécessaire
    };
}


// Cette fonction n'est plus nécessaire car Appwrite gère la connexion.
// export async function openDatabase(): Promise<IDBDatabase | undefined> { ... }
// On s'assurera que la session Appwrite est initialisée avant les opérations.

export async function getAll(): Promise<ChatHistoryItem[]> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) {
    logger.warn('Appwrite not configured, cannot getAll chats.');
    return [];
  }
  await getAppwriteSession(); // S'assurer qu'une session existe
  try {
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_CHATS,
      // Ajoutez des requêtes ici si nécessaire (ex: par utilisateur, tri)
      // [Query.limit(100)] // Pagination
    );
    return response.documents.map(mapDocumentToChatHistoryItem);
  } catch (error) {
    logger.error('Error fetching all chats from Appwrite:', error);
    throw error;
  }
}

export async function setMessages(
  // db: IDBDatabase, // Plus besoin de db en paramètre
  chatId: string, // C'est notre ID métier
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string, // Appwrite gère $createdAt et $updatedAt, mais on peut le forcer
  metadata?: IChatMetadata,
  appwriteDocumentId?: string, // Pour les mises à jour
): Promise<string> { // Retourne l'ID du document Appwrite
  if (!databases || !VITE_APPWRITE_DATABASE_ID) {
    logger.warn('Appwrite not configured, cannot setMessages.');
    throw new Error('Appwrite not configured');
  }
  await getAppwriteSession();

  if (timestamp && isNaN(Date.parse(timestamp))) {
    throw new Error('Invalid timestamp');
  }

  const dataPayload = {
    chatId,
    messages: JSON.stringify(messages),
    urlId: urlId || null, // Appwrite préfère null pour les champs optionnels vides
    description: description || null,
    timestamp: timestamp ?? new Date().toISOString(),
    metadata: metadata ? JSON.stringify(metadata) : null,
    // userId: (await account.get()).$id // Si vous liez à l'utilisateur
  };

  try {
    let doc;
    if (appwriteDocumentId) { // Mise à jour
      doc = await databases.updateDocument(
        VITE_APPWRITE_DATABASE_ID,
        COLLECTION_ID_CHATS,
        appwriteDocumentId,
        dataPayload
      );
    } else { // Création
      // Vérifier si un chat avec ce chatId existe déjà pour éviter les doublons si chatId doit être unique
      const existing = await getMessagesById(chatId, false); // false pour ne pas throw si non trouvé
      if (existing && existing.appwriteDocumentId) {
         doc = await databases.updateDocument(
            VITE_APPWRITE_DATABASE_ID,
            COLLECTION_ID_CHATS,
            existing.appwriteDocumentId,
            dataPayload
          );
      } else {
        doc = await databases.createDocument(
          VITE_APPWRITE_DATABASE_ID,
          COLLECTION_ID_CHATS,
          ID.unique(), // Appwrite génère un ID unique pour le document
          dataPayload
        );
      }
    }
    return doc.$id; // Retourne l'ID du document créé/mis à jour
  } catch (error) {
    logger.error('Error setting messages in Appwrite:', error);
    throw error;
  }
}

// id peut être chatId ou urlId
export async function getMessages(id: string): Promise<ChatHistoryItem | null> {
  let chat = await getMessagesById(id, false);
  if (chat) return chat;
  chat = await getMessagesByUrlId(id, false);
  if (!chat) {
    logger.warn(`Chat not found by id or urlId: ${id}`);
    return null; // ou throw new Error('Chat not found'); si c'est le comportement attendu
  }
  return chat;
}

export async function getMessagesByUrlId(urlId: string, throwIfNotFound = true): Promise<ChatHistoryItem | null> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();
  try {
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_CHATS,
      [Query.equal('urlId', urlId), Query.limit(1)]
    );
    if (response.documents.length > 0) {
      return mapDocumentToChatHistoryItem(response.documents[0]);
    }
    if (throwIfNotFound) throw new Error(`Chat with urlId "${urlId}" not found.`);
    return null;
  } catch (error) {
    logger.error(`Error fetching chat by urlId "${urlId}":`, error);
    if (throwIfNotFound) throw error;
    return null;
  }
}

export async function getMessagesById(chatId: string, throwIfNotFound = true): Promise<ChatHistoryItem | null> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();
  try {
    // Si chatId est l'ID du document Appwrite, utilisez getDocument.
    // Si c'est notre ID métier, il faut lister avec une query.
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_CHATS,
      [Query.equal('chatId', chatId), Query.limit(1)]
    );
    if (response.documents.length > 0) {
      return mapDocumentToChatHistoryItem(response.documents[0]);
    }
    if (throwIfNotFound) throw new Error(`Chat with chatId "${chatId}" not found.`);
    return null;
  } catch (error) {
    logger.error(`Error fetching chat by chatId "${chatId}":`, error);
    if (throwIfNotFound) throw error;
    return null;
  }
}

export async function deleteById(chatDocumentId: string, chatIdForSnapshots: string): Promise<void> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();
  try {
    // 1. Supprimer les snapshots associés
    const snapshots = await databases.listDocuments(
        VITE_APPWRITE_DATABASE_ID,
        COLLECTION_ID_SNAPSHOTS,
        [Query.equal('chatDocumentId', chatDocumentId)] // Ou Query.equal('chatId', chatIdForSnapshots) si vous liez par chatId métier
    );
    for (const snap of snapshots.documents) {
        await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, snap.$id);
    }
    logger.info(`Deleted ${snapshots.documents.length} snapshots for chat ${chatIdForSnapshots}`);

    // 2. Supprimer le chat lui-même
    await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, chatDocumentId);
    logger.info(`Deleted chat ${chatDocumentId}`);
  } catch (error) {
    logger.error(`Error deleting chat ${chatDocumentId} and its snapshots:`, error);
    throw error;
  }
}

// `getNextId` pour `chatId` peut être remplacé par `ID.unique()` d'Appwrite si vous l'utilisez comme `chatId`.
// Si vous avez besoin d'un ID numérique séquentiel, c'est plus complexe avec Appwrite et généralement déconseillé.
// On va assumer que `chatId` sera un UUID généré par le client ou `ID.unique()`.
// La logique de `getNextId` était plus pour `urlId` pour éviter les collisions.
export async function generateNewChatId(): Promise<string> {
    return ID.unique(); // Utilise la fonction d'Appwrite pour générer un ID unique
}

export async function getUrlId(baseId: string): Promise<string> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();

  let potentialUrlId = baseId;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const response = await databases.listDocuments(
        VITE_APPWRITE_DATABASE_ID,
        COLLECTION_ID_CHATS,
        [Query.equal('urlId', potentialUrlId), Query.limit(1)]
      );
      if (response.documents.length === 0) {
        return potentialUrlId; // Cet urlId est disponible
      }
      potentialUrlId = `${baseId}-${i}`;
      i++;
    } catch (error) {
      logger.error(`Error checking urlId availability for "${potentialUrlId}":`, error);
      throw error; // Rethrow, car on ne peut pas garantir l'unicité
    }
  }
}

export async function forkChat(chatIdToFork: string, messageId: string): Promise<string> { // Retourne le nouveau urlId
  const chat = await getMessages(chatIdToFork); // Peut être chatId ou urlId
  if (!chat || !chat.appwriteDocumentId) throw new Error('Chat not found to fork');

  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);
  if (messageIndex === -1) throw new Error('Message not found in chat to fork');

  const messages = chat.messages.slice(0, messageIndex + 1);
  const description = chat.description ? `${chat.description} (fork)` : 'Forked chat';
  
  return createChatFromMessages(description, messages, chat.metadata);
}

export async function duplicateChat(idToDuplicate: string): Promise<string> { // Retourne le nouveau urlId
  const chat = await getMessages(idToDuplicate);
  if (!chat || !chat.appwriteDocumentId) throw new Error('Chat not found to duplicate');

  const description = `${chat.description || 'Chat'} (copy)`;
  return createChatFromMessages(description, chat.messages, chat.metadata);
}

export async function createChatFromMessages(
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> { // Retourne le nouveau urlId
  const newChatId = await generateNewChatId(); // Génère un ID métier unique pour le chat
  const newUrlId = await getUrlId(newChatId.substring(0, 8)); // Base pour l'urlId, par exemple

  await setMessages(
    newChatId,
    messages,
    newUrlId,
    description,
    undefined,
    metadata,
    // pas d'appwriteDocumentId car c'est une création
  );
  return newUrlId;
}

export async function updateChatDescription(id: string, description: string): Promise<void> {
  const chat = await getMessages(id); // Peut être chatId ou urlId
  if (!chat || !chat.appwriteDocumentId) throw new Error('Chat not found to update description');
  if (!description.trim()) throw new Error('Description cannot be empty');

  await setMessages(
    chat.id, // chatId métier
    chat.messages,
    chat.urlId,
    description,
    chat.timestamp, // Ou undefined pour laisser Appwrite mettre à jour $updatedAt
    chat.metadata,
    chat.appwriteDocumentId, // Important pour l'update
  );
}

export async function updateChatMetadata(
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  const chat = await getMessages(id);
  if (!chat || !chat.appwriteDocumentId) throw new Error('Chat not found to update metadata');

  await setMessages(
    chat.id, // chatId métier
    chat.messages,
    chat.urlId,
    chat.description,
    chat.timestamp, // Ou undefined
    metadata,
    chat.appwriteDocumentId, // Important pour l'update
  );
}

// --- Snapshot functions ---
export async function getSnapshot(chatDocumentIdOrChatId: string): Promise<Snapshot | undefined> {
    if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
    await getAppwriteSession();
    try {
        // On suppose que chatDocumentIdOrChatId est l'ID du document Appwrite du chat.
        // Si c'est le chatId métier, il faut d'abord récupérer le chat pour avoir son $id.
        // Ou, si on a stocké `chatId` dans la collection snapshots :
        // Query.equal('chatId', chatDocumentIdOrChatId)
        const response = await databases.listDocuments(
            VITE_APPWRITE_DATABASE_ID,
            COLLECTION_ID_SNAPSHOTS,
            [Query.equal('chatDocumentId', chatDocumentIdOrChatId), Query.orderDesc('$createdAt'), Query.limit(1)] // Le plus récent
        );
        if (response.documents.length > 0) {
            return mapDocumentToSnapshot(response.documents[0]);
        }
        return undefined;
    } catch (error) {
        logger.error(`Error fetching snapshot for chat ${chatDocumentIdOrChatId}:`, error);
        throw error;
    }
}

export async function setSnapshot(chatDocumentId: string, snapshot: Snapshot): Promise<void> {
    if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
    await getAppwriteSession();

    const dataPayload = {
        chatDocumentId, // L'ID du document Appwrite du chat parent
        chatIndex: snapshot.chatIndex,
        files: JSON.stringify(snapshot.files),
        summary: snapshot.summary || null,
        // userId: (await account.get()).$id // Si lié à l'utilisateur
    };

    try {
        // Pourrait vérifier si un snapshot existe déjà pour ce chatIndex et l'update, ou toujours créer.
        // Pour simplifier, on crée toujours un nouveau.
        await databases.createDocument(
            VITE_APPWRITE_DATABASE_ID,
            COLLECTION_ID_SNAPSHOTS,
            ID.unique(),
            dataPayload
        );
    } catch (error) {
        logger.error(`Error setting snapshot for chat ${chatDocumentId}:`, error);
        throw error;
    }
}

export async function deleteSnapshot(chatDocumentId: string, snapshotAppwriteId?: string): Promise<void> {
    if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
    await getAppwriteSession();
    try {
        if (snapshotAppwriteId) { // Supprimer un snapshot spécifique
            await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, snapshotAppwriteId);
        } else { // Supprimer tous les snapshots pour ce chatDocumentId (plus rare, mais pour correspondre à l'original)
            const snapshots = await databases.listDocuments(
                VITE_APPWRITE_DATABASE_ID,
                COLLECTION_ID_SNAPSHOTS,
                [Query.equal('chatDocumentId', chatDocumentId)]
            );
            for (const snap of snapshots.documents) {
                await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, snap.$id);
            }
        }
    } catch (error) {
        // Appwrite lève une erreur si le document n'est pas trouvé, donc pas besoin de gérer NotFoundError spécifiquement comme avec IndexedDB
        logger.error(`Error deleting snapshot(s) for chat ${chatDocumentId}:`, error);
        throw error;
    }
}
