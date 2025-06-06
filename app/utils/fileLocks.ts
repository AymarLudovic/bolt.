// fileLocks.ts
import {
  getLockedItems as getLockedItemsInternal, // Renommer pour éviter conflit si vous exportez getLockedItems
  isFileLocked as isFileLockedInternalAppwrite,     // Renommer l'import
  isFolderLocked as isFolderLockedInternalAppwrite, // Renommer l'import
  // isPathInLockedFolder, // >>> SUPPRIMER CET IMPORT <<<
} from '~/lib/persistence/lockedFiles'; // Chemin vers votre lockedFiles.ts version Appwrite
import { createScopedLogger } from './logger';

const logger = createScopedLogger('FileLocks');

// getCurrentChatId reste la même
export function getCurrentChatId(): string {
  try {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/chat\/([^/]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return 'default'; // Ou l'ID du document Appwrite du chat par défaut si pertinent
  } catch (error) {
    logger.error('Failed to get current chat ID', error);
    return 'default';
  }
}

/**
 * Check if a file is locked.
 * This now directly uses the Appwrite-backed function which handles parent folder locks.
 * @param filePath The path of the file to check
 * @param _chatId DEPRECATED with Appwrite version, chatId is implicit (current chat). Kept for signature compatibility.
 */
export async function isFileLocked(filePath: string, _chatId?: string): Promise<{ locked: boolean; lockedBy?: string }> {
  try {
    // const currentChatId = chatId || getCurrentChatId(); // Plus besoin avec la version Appwrite de lockedFiles.ts
    // qui utilise chatAppwriteDocumentIdAtom

    // Utilise directement la fonction de lockedFiles.ts (version Appwrite)
    // Elle est asynchrone maintenant !
    return await isFileLockedInternalAppwrite(filePath);
  } catch (error) {
    logger.error('Failed to check if file is locked', error);
    return { locked: false };
  }
}

/**
 * Check if a folder is locked.
 * @param folderPath The path of the folder to check
 * @param _chatId DEPRECATED with Appwrite version.
 */
export async function isFolderLocked(folderPath: string, _chatId?: string): Promise<{ locked: boolean; lockedBy?: string }> {
  try {
    // const currentChatId = chatId || getCurrentChatId(); // Plus besoin
    return await isFolderLockedInternalAppwrite(folderPath);
  } catch (error) {
    logger.error('Failed to check if folder is locked', error);
    return { locked: false };
  }
}

/**
 * Check if any files are locked in the current chat
 * @param _chatId DEPRECATED with Appwrite version.
 */
export async function hasLockedItems(_chatId?: string): Promise<boolean> {
  try {
    // const currentChatId = chatId || getCurrentChatId(); // Plus besoin
    const lockedItems = await getLockedItemsInternal(); // Renommé pour éviter conflit si vous exportez une fonction getLockedItems d'ici
    // La version Appwrite de getLockedItemsInternal ne filtre plus par chatId ici,
    // elle le fait en interne pour le chat courant.
    return lockedItems.length > 0;
  } catch (error) {
    logger.error('Failed to check for locked items', error);
    return false;
  }
}

// Optionnel : si vous avez besoin d'une fonction getLockedItems exportée d'ici
export async function getLockedItems(): Promise<import('~/lib/persistence/lockedFiles').LockedItem[]> {
    return await getLockedItemsInternal();
}
