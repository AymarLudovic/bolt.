// app/lib/persistence/db.ts
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
  getAppwriteSession,
} from '~/lib/appwrite';

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('ChatHistoryAppwriteDB'); // Nom de logger légèrement différent pour clarté

function mapDocumentToChatHistoryItem(doc: any): ChatHistoryItem {
  if (!doc || !doc.chatId || !doc.$id || typeof doc.timestamp === 'undefined') {
    logger.error("db.ts: mapDocumentToChatHistoryItem - Document invalide ou champs essentiels manquants", JSON.stringify(doc).substring(0,300));
    return {
        id: doc?.chatId || `error-id-${Date.now()}`,
        appwriteDocumentId: doc?.$id || 'error-appwrite-id',
        urlId: undefined,
        description: 'Error: Invalid chat data from DB',
        messages: [],
        timestamp: new Date().toISOString(),
        metadata: undefined,
    } as ChatHistoryItem;
  }

  try {
    const messages = JSON.parse(doc.messages || '[]');
    const metadata = doc.metadata ? JSON.parse(doc.metadata) : undefined;

    let descriptionToUse = doc.description;
    if (descriptionToUse === null || descriptionToUse === undefined || (typeof descriptionToUse === 'string' && !descriptionToUse.trim())) {
        let dateString = "Unknown Date";
        const ts = doc.timestamp || doc.$createdAt; // Priorité au timestamp du chat, sinon $createdAt d'Appwrite
        if (ts && !isNaN(new Date(ts).getTime())) {
            dateString = new Date(ts).toLocaleDateString();
        }
        descriptionToUse = `Chat (${doc.chatId.substring(0, 6)}) - ${dateString}`;
        // logger.warn(`db.ts: mapDocumentToChatHistoryItem - Doc ${doc.$id} (chatId: ${doc.chatId}) has null/empty description. Defaulting to: "${descriptionToUse}"`);
    }

    const urlIdToUse = doc.urlId?.trim() ? doc.urlId.trim() : undefined;
    // if (doc.urlId && !urlIdToUse) {
    //     logger.warn(`db.ts: mapDocumentToChatHistoryItem - Doc ${doc.$id} (chatId: ${doc.chatId}) has empty urlId. Setting to undefined.`);
    // }

    return {
      id: doc.chatId,
      appwriteDocumentId: doc.$id,
      urlId: urlIdToUse,
      description: descriptionToUse,
      messages: messages as Message[],
      timestamp: doc.timestamp,
      metadata: metadata,
    };
  } catch (e) {
    logger.error(`db.ts: mapDocumentToChatHistoryItem - Error for doc $id ${doc.$id}, chatId ${doc.chatId}:`, e, "Raw doc messages:", doc.messages, "Raw doc metadata:", doc.metadata);
    return {
        id: doc.chatId,
        appwriteDocumentId: doc.$id,
        urlId: doc.urlId || undefined,
        description: `Error loading title for ${doc.chatId.substring(0,8)}`,
        messages: [],
        timestamp: doc.timestamp || new Date().toISOString(),
        metadata: undefined,
    } as ChatHistoryItem;
  }
}

function mapDocumentToSnapshot(doc: any): Snapshot | undefined {
    if (!doc || !doc.chatId) { // chatId est la clé pour les snapshots dans Appwrite
        logger.error("db.ts: mapDocumentToSnapshot - Document ou doc.chatId (keyPath) manquant", doc);
        return undefined;
    }
    try {
        return {
            chatIndex: doc.chatIndex, // Assurez-vous que ces champs existent dans vos documents snapshot
            files: JSON.parse(doc.files || '{}'),
            summary: doc.summary,
        };
    } catch(e) {
        logger.error(`db.ts: mapDocumentToSnapshot - JSON parsing error for snapshot of chat ${doc.chatId}:`, e, "Raw files data:", doc.files);
        return undefined; // ou un snapshot partiel indiquant une erreur
    }
}

export async function getAll(): Promise<ChatHistoryItem[]> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) {
    logger.warn('db.ts: Appwrite not configured, cannot getAll chats.');
    return [];
  }
  // logger.info('db.ts: Attempting to get Appwrite session for getAll...'); // Peut être verbeux
  await getAppwriteSession();
  // logger.info('db.ts: Appwrite session obtained. Fetching all chats from Appwrite...');
  try {
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_CHATS,
      [Query.orderDesc('timestamp')] // Optionnel: trier par timestamp descendant
    );
    // logger.info(`db.ts: Appwrite response for getAll: ${response.total} total documents found.`);
    // if (response.documents.length === 0) {
    //     logger.warn('db.ts: No documents found in Appwrite chats collection by listDocuments.');
    // }

    const mappedItems = response.documents.map(doc => {
        try {
            return mapDocumentToChatHistoryItem(doc);
        } catch (mapError) {
            logger.error(`db.ts: Error during explicit mapping for document ${doc.$id} (chatId: ${doc.chatId}):`, mapError, "Raw doc:", JSON.stringify(doc).substring(0,200));
            return null; // Pour filtrer plus tard
        }
    }).filter(item => item !== null) as ChatHistoryItem[];

    // logger.info(`db.ts: Mapped ${mappedItems.length} chat items successfully.`);
    return mappedItems;
  } catch (error) {
    logger.error('db.ts: Error during databases.listDocuments in getAll:', error);
    throw error;
  }
}

export async function setMessages(
  chatId: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
  appwriteDocumentId?: string,
): Promise<string> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) {
    logger.warn('db.ts: Appwrite not configured, cannot setMessages.');
    throw new Error('Appwrite not configured');
  }
  await getAppwriteSession();

  if (timestamp && isNaN(Date.parse(timestamp))) {
    logger.error(`db.ts: Invalid timestamp provided for setMessages: ${timestamp}`);
    throw new Error('Invalid timestamp');
  }

  const finalDescription = (description?.trim()) ? description.trim() : null; // Stocker null si vide
  // Si vous voulez absolument une description, utilisez le fallback comme dans mapDocumentToChatHistoryItem
  // const finalDescription = (description?.trim()) ? description.trim() : `Chat (${chatId.substring(0,6)}) - ${new Date(timestamp || Date.now()).toLocaleDateString()}`;


  const dataPayload = {
    chatId,
    messages: JSON.stringify(messages),
    urlId: urlId || null,
    description: finalDescription,
    timestamp: timestamp ?? new Date().toISOString(),
    metadata: metadata ? JSON.stringify(metadata) : null,
  };

  try {
    let doc;
    if (appwriteDocumentId) {
      logger.info(`db.ts: Updating document ${appwriteDocumentId} for chatId ${chatId}`);
      doc = await databases.updateDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, appwriteDocumentId, dataPayload);
    } else {
      const existing = await getMessagesById(chatId, false);
      if (existing && existing.appwriteDocumentId) {
        logger.info(`db.ts: Found existing document ${existing.appwriteDocumentId} for chatId ${chatId}, updating.`);
        doc = await databases.updateDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, existing.appwriteDocumentId, dataPayload);
      } else {
        logger.info(`db.ts: No existing document for chatId ${chatId}, creating new.`);
        doc = await databases.createDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, ID.unique(), dataPayload);
      }
    }
    logger.info(`db.ts: Successfully setMessages for chatId ${chatId}, Appwrite Doc ID: ${doc.$id}`);
    return doc.$id;
  } catch (error) {
    logger.error(`db.ts: Error setting messages in Appwrite for chatId ${chatId}:`, error, "Payload:", dataPayload);
    throw error;
  }
}

export async function getMessages(id: string): Promise<ChatHistoryItem | null> {
  if (!id?.trim()) {
    logger.warn("db.ts: getMessages called with empty or invalid ID.");
    return null;
  }
  let chat = await getMessagesById(id, false);
  if (chat) return chat;
  chat = await getMessagesByUrlId(id, false);
  // if (!chat) {
  //   logger.warn(`db.ts: Chat not found by id or urlId: ${id}`);
  // }
  return chat;
}

export async function getMessagesByUrlId(urlId: string, throwIfNotFound = true): Promise<ChatHistoryItem | null> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) { logger.error("db.ts: Appwrite not configured for getMessagesByUrlId"); throw new Error('Appwrite not configured');}
  if (!urlId?.trim()) { logger.warn("db.ts: getMessagesByUrlId called with empty URL ID."); if (throwIfNotFound) throw new Error("Invalid URL ID"); return null; }
  await getAppwriteSession();
  try {
    const response = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, [Query.equal('urlId', urlId), Query.limit(1)]);
    if (response.documents.length > 0) return mapDocumentToChatHistoryItem(response.documents[0]);
    if (throwIfNotFound) throw new Error(`Chat with urlId "${urlId}" not found.`);
    return null;
  } catch (error) {
    logger.error(`db.ts: Error fetching chat by urlId "${urlId}":`, error);
    if (throwIfNotFound) throw error;
    return null;
  }
}

export async function getMessagesById(chatId: string, throwIfNotFound = true): Promise<ChatHistoryItem | null> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) { logger.error("db.ts: Appwrite not configured for getMessagesById"); throw new Error('Appwrite not configured');}
  if (!chatId?.trim()) { logger.warn("db.ts: getMessagesById called with empty chat ID."); if (throwIfNotFound) throw new Error("Invalid chat ID"); return null; }
  await getAppwriteSession();
  try {
    const response = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, [Query.equal('chatId', chatId), Query.limit(1)]);
    if (response.documents.length > 0) return mapDocumentToChatHistoryItem(response.documents[0]);
    if (throwIfNotFound) throw new Error(`Chat with chatId "${chatId}" not found.`);
    return null;
  } catch (error) {
    logger.error(`db.ts: Error fetching chat by chatId "${chatId}":`, error);
    if (throwIfNotFound) throw error;
    return null;
  }
}

export async function deleteById(chatDocumentId: string, chatIdForSnapshots: string): Promise<void> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) { logger.error("db.ts: Appwrite not configured for deleteById"); throw new Error('Appwrite not configured');}
  if (!chatDocumentId?.trim() || !chatIdForSnapshots?.trim()) { logger.error("db.ts: deleteById called with invalid IDs.", { chatDocumentId, chatIdForSnapshots }); throw new Error("Invalid ID for deletion."); }
  await getAppwriteSession();
  try {
    const snapshots = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, [Query.equal('chatDocumentId', chatDocumentId)]);
    logger.info(`db.ts: Found ${snapshots.documents.length} snapshots to delete for chat associated with Appwrite doc ${chatDocumentId} (chatId: ${chatIdForSnapshots})`);
    for (const snap of snapshots.documents) {
      await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, snap.$id);
    }
    await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, chatDocumentId);
    logger.info(`db.ts: Deleted chat ${chatDocumentId} (chatId: ${chatIdForSnapshots}) and its snapshots.`);
  } catch (error) {
    logger.error(`db.ts: Error deleting chat ${chatDocumentId} (chatId: ${chatIdForSnapshots}) and/or its snapshots:`, error);
    throw error;
  }
}

export async function generateNewChatId(): Promise<string> {
  return ID.unique();
}

export async function getUrlId(baseId: string): Promise<string> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) { logger.error("db.ts: Appwrite not configured for getUrlId"); throw new Error('Appwrite not configured');}
  if (!baseId?.trim()) { logger.error("db.ts: getUrlId called with empty baseId."); throw new Error("Base ID cannot be empty."); }
  await getAppwriteSession();
  let potentialUrlId = baseId;
  let i = 2;
  while (true) {
    try {
      const response = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_CHATS, [Query.equal('urlId', potentialUrlId), Query.limit(1)]);
      if (response.documents.length === 0) return potentialUrlId;
      potentialUrlId = `${baseId}-${i++}`;
    } catch (error) {
      logger.error(`db.ts: Error checking urlId availability for "${potentialUrlId}":`, error);
      throw error;
    }
  }
}

export async function forkChat(chatIdToFork: string, messageId: string): Promise<string> {
  logger.info(`db.ts: Forking chat ${chatIdToFork} at message ${messageId}`);
  const chat = await getMessages(chatIdToFork);
  if (!chat || !chat.appwriteDocumentId) { logger.error(`db.ts: Chat ${chatIdToFork} not found to fork.`); throw new Error('Chat not found to fork');}
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);
  if (messageIndex === -1) { logger.error(`db.ts: Message ${messageId} not found in chat ${chatIdToFork}.`); throw new Error('Message not found in chat to fork');}
  const messages = chat.messages.slice(0, messageIndex + 1);
  const description = chat.description ? `${chat.description} (fork)` : `Fork of ${chat.id.substring(0,6)}`;
  return createChatFromMessages(description, messages, chat.metadata);
}

export async function duplicateChat(idToDuplicate: string): Promise<string> {
  logger.info(`db.ts: Duplicating chat ${idToDuplicate}`);
  const chat = await getMessages(idToDuplicate);
  if (!chat || !chat.appwriteDocumentId) { logger.error(`db.ts: Chat ${idToDuplicate} not found to duplicate.`); throw new Error('Chat not found to duplicate');}
  const description = `${chat.description || `Chat ${chat.id.substring(0,6)}`} (copy)`;
  return createChatFromMessages(description, chat.messages, chat.metadata);
}

export async function createChatFromMessages(
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  const newChatId = await generateNewChatId();
  const newUrlId = await getUrlId(description.substring(0,15).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || newChatId.substring(0, 8));
  logger.info(`db.ts: Creating new chat with newChatId: ${newChatId}, newUrlId: ${newUrlId}, description: "${description}"`);
  await setMessages(newChatId, messages, newUrlId, description, undefined, metadata);
  return newUrlId;
}

export async function updateChatDescription(id: string, description: string): Promise<void> {
  logger.info(`db.ts: Updating description for chat ${id} to "${description}"`);
  const chat = await getMessages(id);
  if (!chat || !chat.appwriteDocumentId) { logger.error(`db.ts: Chat ${id} not found for description update.`); throw new Error('Chat not found');}
  if (!description?.trim()) { logger.error(`db.ts: Description cannot be empty for chat ${id}.`); throw new Error('Description cannot be empty');}
  await setMessages(chat.id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata, chat.appwriteDocumentId);
}

export async function updateChatMetadata(id: string, metadata: IChatMetadata | undefined ): Promise<void> {
  logger.info(`db.ts: Updating metadata for chat ${id}.`);
  const chat = await getMessages(id);
  if (!chat || !chat.appwriteDocumentId) { logger.error(`db.ts: Chat ${id} not found for metadata update.`); throw new Error('Chat not found');}
  await setMessages(chat.id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata, chat.appwriteDocumentId);
}

export async function getSnapshot(chatDocumentId: string): Promise<Snapshot | undefined> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) { logger.error("db.ts: Appwrite not configured for getSnapshot"); throw new Error('Appwrite not configured');}
  if (!chatDocumentId?.trim()) { logger.warn("db.ts: getSnapshot called with empty chatDocumentId."); return undefined; }
  await getAppwriteSession();
  try {
    const response = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, [Query.equal('chatDocumentId', chatDocumentId), Query.orderDesc('$createdAt'), Query.limit(1)]);
    if (response.documents.length > 0) return mapDocumentToSnapshot(response.documents[0]);
    return undefined;
  } catch (error) {
    logger.error(`db.ts: Error fetching snapshot for chat doc ${chatDocumentId}:`, error);
    throw error; // Ou retourner undefined
  }
}

export async function setSnapshot(chatDocumentId: string, snapshot: Snapshot): Promise<void> {
   if (!databases || !VITE_APPWRITE_DATABASE_ID) { logger.error("db.ts: Appwrite not configured for setSnapshot"); throw new Error('Appwrite not configured');}
   if (!chatDocumentId?.trim()) { logger.error("db.ts: setSnapshot called with empty chatDocumentId."); throw new Error("chatDocumentId cannot be empty for snapshot."); }
   await getAppwriteSession();
   const dataPayload = { chatDocumentId, chatIndex: snapshot.chatIndex, files: JSON.stringify(snapshot.files), summary: snapshot.summary || null };
   try {
    await databases.createDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, ID.unique(), dataPayload);
    logger.info(`db.ts: Snapshot set for chat doc ${chatDocumentId}`);
   } catch (error) {
    logger.error(`db.ts: Error setting snapshot for chat doc ${chatDocumentId}:`, error, "Payload:", dataPayload);
    throw error;
   }
}

export async function deleteSnapshot(chatDocumentId: string, snapshotAppwriteId?: string): Promise<void> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) { logger.error("db.ts: Appwrite not configured for deleteSnapshot"); throw new Error('Appwrite not configured');}
  if (!chatDocumentId?.trim() && !snapshotAppwriteId?.trim()) { logger.error("db.ts: deleteSnapshot called with no valid ID."); throw new Error("Either chatDocumentId or snapshotAppwriteId is required.");}
  await getAppwriteSession();
  try {
    if (snapshotAppwriteId) {
      await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, snapshotAppwriteId);
      logger.info(`db.ts: Deleted specific snapshot ${snapshotAppwriteId}`);
    } else if (chatDocumentId) { // S'assurer que chatDocumentId est présent si snapshotAppwriteId ne l'est pas
      const snapshots = await databases.listDocuments(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, [Query.equal('chatDocumentId', chatDocumentId)]);
      logger.info(`db.ts: Found ${snapshots.documents.length} snapshots to delete for chat doc ${chatDocumentId}`);
      for (const snap of snapshots.documents) {
        await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_SNAPSHOTS, snap.$id);
      }
    }
  } catch (error) {
    logger.error(`db.ts: Error deleting snapshot(s) for chat doc ${chatDocumentId} or snapshot ${snapshotAppwriteId}:`, error);
    throw error;
  }
}
