// lockedFiles.ts
import { createScopedLogger } from '~/utils/logger';
import {
  databases,
  ID,
  Query,
  VITE_APPWRITE_DATABASE_ID,
  COLLECTION_ID_LOCKED_ITEMS,
  getAppwriteSession,
  account // Pour obtenir le userId si nécessaire
} from '~/lib/appwrite'; // Ajustez le chemin
import { chatIdAtom, chatAppwriteDocumentIdAtom } from '~/lib/persistence/useChatHistory'; // Pour obtenir le chat actuel

const logger = createScopedLogger('LockedFilesAppwrite');

// export const LOCKED_FILES_KEY = 'bolt.lockedFiles'; // Plus nécessaire

export interface LockedItem {
  appwriteDocumentId?: string; // ID du document Appwrite
  chatDocumentId: string; // ID du document Appwrite du chat parent
  path: string;
  isFolder: boolean;
  // userId?: string; // Si vous voulez lier au user Appwrite
}

// Le cache en mémoire peut toujours être utile, mais doit être synchronisé avec Appwrite.
// Pour une version plus simple, on peut interroger Appwrite à chaque fois,
// ou implémenter un cache plus robuste avec invalidation ou Appwrite Realtime.
// Pour l'instant, on va interroger Appwrite, mais garder à l'esprit que le cache est une optimisation.

async function getCurrentChatDocId(): Promise<string | undefined> {
    // Tenter d'obtenir l'ID du document Appwrite du chat actuel.
    // Cela dépend de comment vous gérez l'état global du chat actif.
    // Par exemple, si vous avez un store nanostores :
    return chatAppwriteDocumentIdAtom.get();
}

/**
 * Get locked items for the current chat from Appwrite
 */
export async function getLockedItems(): Promise<LockedItem[]> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) return [];
  await getAppwriteSession();
  const currentChatDocId = await getCurrentChatDocId();
  if (!currentChatDocId) {
    logger.warn('No active chat document ID found, cannot get locked items.');
    return [];
  }

  try {
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_LOCKED_ITEMS,
      [Query.equal('chatDocumentId', currentChatDocId), Query.limit(100)] // Supposer max 100 verrous par chat
    );
    return response.documents.map(doc => ({
      appwriteDocumentId: doc.$id,
      chatDocumentId: doc.chatDocumentId,
      path: doc.path,
      isFolder: doc.isFolder,
    }));
  } catch (error) {
    logger.error('Failed to get locked items from Appwrite:', error);
    return []; // Retourner vide en cas d'erreur pour ne pas bloquer
  }
}

/**
 * Add a file or folder to the locked items list for the current chat
 */
export async function addLockedItem(path: string, isFolder: boolean = false): Promise<void> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();
  const currentChatDocId = await getCurrentChatDocId();
  if (!currentChatDocId) {
    logger.error('No active chat document ID, cannot add locked item.');
    throw new Error('No active chat document ID to associate lock with.');
  }

  // Vérifier si l'élément est déjà verrouillé pour éviter les doublons
  const existingLocks = await getLockedItems(); // Pour le chat actuel
  const alreadyLocked = existingLocks.find(item => item.path === path && item.chatDocumentId === currentChatDocId);
  if (alreadyLocked) {
    logger.info(`Item ${path} is already locked for chat ${currentChatDocId}.`);
    if (alreadyLocked.isFolder !== isFolder) { // Mettre à jour isFolder si différent
        try {
            await databases.updateDocument(
                VITE_APPWRITE_DATABASE_ID,
                COLLECTION_ID_LOCKED_ITEMS,
                alreadyLocked.appwriteDocumentId!,
                { isFolder }
            );
        } catch (error) {
             logger.error(`Failed to update isFolder for locked item ${path}:`, error);
        }
    }
    return;
  }

  const newItemPayload = {
    chatDocumentId: currentChatDocId,
    path,
    isFolder,
    // userId: (await account.get()).$id // Si pertinent
  };

  try {
    await databases.createDocument(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_LOCKED_ITEMS,
      ID.unique(),
      newItemPayload
    );
    logger.info(`Added locked ${isFolder ? 'folder' : 'file'}: ${path} for chat: ${currentChatDocId}`);
  } catch (error) {
    logger.error(`Failed to add locked item ${path} to Appwrite:`, error);
    throw error;
  }
}

export function addLockedFile(filePath: string): Promise<void> { // chatId n'est plus nécessaire, il est implicite
  return addLockedItem(filePath, false);
}
export function addLockedFolder(folderPath: string): Promise<void> { // chatId n'est plus nécessaire
  return addLockedItem(folderPath, true);
}


/**
 * Remove an item from the locked items list for the current chat
 */
export async function removeLockedItem(path: string): Promise<void> {
  if (!databases || !VITE_APPWRITE_DATABASE_ID) throw new Error('Appwrite not configured');
  await getAppwriteSession();
  const currentChatDocId = await getCurrentChatDocId();
  if (!currentChatDocId) {
    logger.warn('No active chat document ID, cannot remove locked item.');
    return; // Ou throw error
  }

  try {
    // Trouver le document à supprimer
    const response = await databases.listDocuments(
      VITE_APPWRITE_DATABASE_ID,
      COLLECTION_ID_LOCKED_ITEMS,
      [
        Query.equal('chatDocumentId', currentChatDocId),
        Query.equal('path', path),
        Query.limit(1)
      ]
    );

    if (response.documents.length > 0) {
      const docToDelete = response.documents[0];
      await databases.deleteDocument(VITE_APPWRITE_DATABASE_ID, COLLECTION_ID_LOCKED_ITEMS, docToDelete.$id);
      logger.info(`Removed lock for: ${path} in chat: ${currentChatDocId}`);
    } else {
      logger.warn(`Lock not found for path: ${path} in chat: ${currentChatDocId} to remove.`);
    }
  } catch (error) {
    logger.error(`Failed to remove lock for ${path} from Appwrite:`, error);
    throw error;
  }
}

export function removeLockedFile(filePath: string): Promise<void> { // chatId n'est plus nécessaire
  return removeLockedItem(filePath);
}
export function removeLockedFolder(folderPath: string): Promise<void> { // chatId n'est plus nécessaire
  return removeLockedItem(folderPath);
}


// Les fonctions de vérification (isPathDirectlyLocked, isFileLocked, etc.)
// devront appeler getLockedItems() puis filtrer/vérifier en mémoire comme avant.
// Le `chatId` en paramètre n'est plus nécessaire si on opère sur le chat courant.
// Si vous devez vérifier pour un chatId *spécifique* (différent du courant), il faudra adapter getLockedItems.

export async function isPathDirectlyLocked(path: string): Promise<{ locked: boolean; isFolder?: boolean }> {
  const lockedItems = await getLockedItems(); // Pour le chat actuel
  const lockedItem = lockedItems.find(item => item.path === path);
  if (lockedItem) {
    return { locked: true, isFolder: lockedItem.isFolder };
  }
  return { locked: false };
}

export async function isFileLocked(filePath: string): Promise<{ locked: boolean; lockedBy?: string }> {
  const lockedItems = await getLockedItems(); // Pour le chat actuel

  const directLock = lockedItems.find(item => item.path === filePath && !item.isFolder);
  if (directLock) {
    return { locked: true, lockedBy: filePath };
  }

  // Check parent folder locks
  const pathParts = filePath.split('/');
  let currentParentPath = '';
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentParentPath = currentParentPath ? `${currentParentPath}/${pathParts[i]}` : pathParts[i];
    const folderLock = lockedItems.find(item => item.path === currentParentPath && item.isFolder);
    if (folderLock) {
      return { locked: true, lockedBy: currentParentPath };
    }
  }
  return { locked: false };
}

export async function isFolderLocked(folderPath: string): Promise<{ locked: boolean; lockedBy?: string }> {
    const lockedItems = await getLockedItems(); // Pour le chat actuel

    const directLock = lockedItems.find(item => item.path === folderPath && item.isFolder);
    if (directLock) {
        return { locked: true, lockedBy: folderPath };
    }
    // Check parent folder locks (si un dossier parent de ce dossier est verrouillé)
    const pathParts = folderPath.split('/');
    let currentParentPath = '';
    for (let i = 0; i < pathParts.length - 1; i++) { // Jusqu'à l'avant-dernier segment
        currentParentPath = currentParentPath ? `${currentParentPath}/${pathParts[i]}` : pathParts[i];
        const parentFolderLock = lockedItems.find(item => item.path === currentParentPath && item.isFolder);
        if (parentFolderLock) {
            return { locked: true, lockedBy: currentParentPath };
        }
    }
    return { locked: false };
}

// getLockedItemsForChat, getLockedFilesForChat, getLockedFoldersForChat
// Ces fonctions ne sont plus nécessaires si on opère toujours sur le chat courant.
// Si vous avez besoin de récupérer les verrous pour un chatId spécifique,
// il faudrait une fonction `getLockedItemsForChatDocId(chatDocId: string)`

// migrateLegacyLocks, clearCache, batchLockItems, batchUnlockItems
// Ces fonctions sont spécifiques à l'implémentation localStorage et devront être
// soit supprimées, soit adaptées drastiquement à la logique Appwrite.
// La migration n'est plus pertinente. clearCache aussi.
// Les opérations batch pourraient être implémentées en bouclant sur add/removeLockedItem
// ou en utilisant des fonctions Appwrite si disponibles (pas pour la création/suppression multiple de documents côté client).

// Le listener 'storage' n'est plus pertinent. Pour la synchronisation entre onglets,
// vous pourriez explorer Appwrite Realtime pour la collection `lockedItems`.
