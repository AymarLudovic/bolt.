// files.ts
import type { PathWatcherEvent, WebContainer } from '@webcontainer/api';
import { getEncoding } from 'istextorbinary';
import { map, type MapStore } from 'nanostores';
import { Buffer } from 'buffer/'; // Assurez-vous que c'est bien 'buffer/' et non 'buffer' si c'est pour le navigateur
import { path as pathUtils } from '~/utils/path'; // Renommé pour éviter conflit avec l'import de 'path' si vous en aviez un
import { bufferWatchEvents } from '~/utils/buffer';
import { WORK_DIR } from '~/utils/constants';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import {
  addLockedItem, // Utiliser addLockedItem (plus générique) ou garder addLockedFile/Folder si vous préférez
  removeLockedItem, // Idem
  // getLockedItemsForChat, // Remplacé par getLockedItems()
  // getLockedFilesForChat, // Dérivé de getLockedItems()
  // getLockedFoldersForChat, // Dérivé de getLockedItems()
  // isPathInLockedFolder, // Logique intégrée ou à recréer si besoin spécifique
  // migrateLegacyLocks, // Plus pertinent avec Appwrite
  // clearCache, // Plus pertinent avec Appwrite comme source de vérité
  getLockedItems, // Fonction principale pour obtenir les verrous du chat courant
  isFileLocked as isFileLockedAppwrite, // Renommer pour éviter conflit
  isFolderLocked as isFolderLockedAppwrite, // Renommer
  type LockedItem, // Importer le type si nécessaire
} from '~/lib/persistence/lockedFiles'; // Assurez-vous que le chemin est correct
import { getCurrentChatId as getCurrentChatUrlId } from '~/utils/fileLocks'; // Cette fonction donne l'ID de l'URL, pas l'ID du document Appwrite

const logger = createScopedLogger('FilesStore');

const utf8TextDecoder = new TextDecoder('utf8', { fatal: true });

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

export interface Folder {
  type: 'folder';
  isLocked?: boolean;
  lockedByFolder?: string;
}

type Dirent = File | Folder;
export type FileMap = Record<string, Dirent | undefined>;

export class FilesStore {
  #webcontainer: Promise<WebContainer>;
  #size = 0;
  #modifiedFiles: Map<string, string> = import.meta.hot?.data.modifiedFiles ?? new Map();
  #deletedPaths: Set<string> = import.meta.hot?.data.deletedPaths ?? new Set();
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});

  get filesCount() {
    return this.#size;
  }

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    // ... (chargement de deletedPaths depuis localStorage reste pareil)
    try {
      if (typeof localStorage !== 'undefined') {
        const deletedPathsJson = localStorage.getItem('bolt-deleted-paths');
        if (deletedPathsJson) {
          const deletedPathsArray = JSON.parse(deletedPathsJson);
          if (Array.isArray(deletedPathsArray)) {
            deletedPathsArray.forEach((p) => this.#deletedPaths.add(p));
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load deleted paths from localStorage', error);
    }


    if (import.meta.hot) {
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
      import.meta.hot.data.deletedPaths = this.#deletedPaths;
    }

    // Le listener pour le changement de chat ID est toujours utile,
    // mais #loadLockedFiles va devenir asynchrone.
    if (typeof window !== 'undefined') {
      let lastChatUrlId = getCurrentChatUrlId();
      const observer = new MutationObserver(async () => { // Devient async
        const currentChatUrlId = getCurrentChatUrlId();
        if (currentChatUrlId !== lastChatUrlId) {
          logger.info(`Chat URL ID changed from ${lastChatUrlId} to ${currentChatUrlId}, reloading locks`);
          lastChatUrlId = currentChatUrlId;
          // Note: #loadLockedFiles opère maintenant sur le chatDocumentId implicite via le store global.
          // Le changement d'URL devrait déclencher une mise à jour du chatDocumentIdAtom dans useChatHistory,
          // ce qui sera pris en compte par #loadLockedFiles.
          await this.#loadLockedFiles();
        }
      });
      observer.observe(document, { subtree: true, childList: true });
    }

    this.#init();
  }

  async #loadLockedFiles() { // Devient async
    try {
      const startTime = performance.now();
      // migrateLegacyLocks(currentChatId); // SUPPRIMÉ

      // getLockedItems() de la version Appwrite ne prend plus chatId,
      // il utilise le chatDocumentId du store global.
      const lockedItemsAppwrite: LockedItem[] = await getLockedItems();

      if (lockedItemsAppwrite.length === 0) {
        logger.info(`No locked items found for current chat in Appwrite.`);
        // Il faut aussi s'assurer de "déverrouiller" les fichiers en mémoire s'ils l'étaient avant
        const currentFiles = this.files.get();
        const updates: FileMap = {};
        let changed = false;
        for(const path in currentFiles) {
            const dirent = currentFiles[path];
            if (dirent && (dirent.isLocked || dirent.lockedByFolder)) {
                updates[path] = { ...dirent, isLocked: false, lockedByFolder: undefined };
                changed = true;
            }
        }
        if (changed) {
            this.files.set({ ...currentFiles, ...updates });
        }
        return;
      }

      logger.info(
        `Found ${lockedItemsAppwrite.length} locked items for current chat from Appwrite.`,
      );

      const currentFiles = this.files.get();
      const updates: FileMap = {};
      const allPathsInStore = new Set(Object.keys(currentFiles));
      const lockedPathsFromAppwrite = new Set(lockedItemsAppwrite.map(item => item.path));

      // D'abord, déverrouiller en mémoire les fichiers qui ne sont plus verrouillés dans Appwrite
      for (const path in currentFiles) {
        const dirent = currentFiles[path];
        if (dirent && (dirent.isLocked || dirent.lockedByFolder) && !lockedPathsFromAppwrite.has(path)) {
            // Et aussi vérifier si un dossier parent n'est plus verrouillé
            let parentStillLocks = false;
            for (const lockedItem of lockedItemsAppwrite) {
                if (lockedItem.isFolder && path.startsWith(lockedItem.path + '/')) {
                    parentStillLocks = true;
                    updates[path] = { ...dirent, isLocked: true, lockedByFolder: lockedItem.path };
                    break;
                }
            }
            if(!parentStillLocks) {
                 updates[path] = { ...dirent, isLocked: false, lockedByFolder: undefined };
            }
        }
      }


      // Appliquer les verrous d'Appwrite
      for (const lockedItem of lockedItemsAppwrite) {
        const dirent = currentFiles[lockedItem.path] || updates[lockedItem.path]; // Prendre en compte les updates précédentes

        if (dirent) { // Si le fichier/dossier existe en mémoire
          if (dirent.type === 'file' && !lockedItem.isFolder) {
            updates[lockedItem.path] = { ...dirent, isLocked: true, lockedByFolder: undefined };
          } else if (dirent.type === 'folder' && lockedItem.isFolder) {
            updates[lockedItem.path] = { ...dirent, isLocked: true, lockedByFolder: undefined };
            // Marquer le contenu du dossier comme verrouillé par ce dossier
            this.#applyLockToFolderContents(currentFiles, updates, lockedItem.path, lockedItemsAppwrite);
          }
        } else if (lockedItem.isFolder) { // Si le dossier verrouillé n'est pas en mémoire, marquer son contenu
            this.#applyLockToFolderContents(currentFiles, updates, lockedItem.path, lockedItemsAppwrite);
        }
        // Si un fichier verrouillé n'est pas en mémoire, on ne peut pas le marquer.
        // On suppose que s'il est créé plus tard, son état de verrouillage sera vérifié.
      }


      if (Object.keys(updates).length > 0) {
        this.files.set({ ...currentFiles, ...updates });
      }

      const endTime = performance.now();
      logger.info(`Loaded and applied locked items from Appwrite in ${Math.round(endTime - startTime)}ms`);
    } catch (error) {
      logger.error('Failed to load locked files from Appwrite', error);
    }
  }

  #applyLockToFolderContents(currentFiles: FileMap, updates: FileMap, folderPath: string, allLockedItems: LockedItem[]) {
    const folderPrefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;

    Object.entries(currentFiles).forEach(([itemPath, dirent]) => {
      if (itemPath.startsWith(folderPrefix) && dirent) {
        // Ne pas écraser un verrou direct sur un sous-élément
        if (allLockedItems.find(li => li.path === itemPath)) return;

        const existingUpdate = updates[itemPath];
        if (dirent.type === 'file') {
          updates[itemPath] = { ...(existingUpdate || dirent), isLocked: true, lockedByFolder: folderPath };
        } else if (dirent.type === 'folder') {
          updates[itemPath] = { ...(existingUpdate || dirent), isLocked: true, lockedByFolder: folderPath };
        }
      }
    });
  }

  async lockFile(filePath: string) { // chatId n'est plus nécessaire ici
    const file = this.getFile(filePath);
    if (!file) {
      logger.error(`Cannot lock non-existent file: ${filePath}`);
      return false;
    }
    this.files.setKey(filePath, { ...file, isLocked: true, lockedByFolder: undefined });
    try {
      await addLockedItem(filePath, false); // Appel async à Appwrite
      logger.info(`File locked: ${filePath} (Appwrite)`);
      return true;
    } catch (e) {
      logger.error(`Failed to lock file ${filePath} in Appwrite`, e);
      this.files.setKey(filePath, { ...file, isLocked: false }); // Revert UI on error
      return false;
    }
  }

  async lockFolder(folderPath: string) { // chatId n'est plus nécessaire ici
    const folder = this.getFileOrFolder(folderPath);
    if (!folder || folder.type !== 'folder') {
      logger.error(`Cannot lock non-existent folder: ${folderPath}`);
      return false;
    }

    const currentFiles = this.files.get();
    const updates: FileMap = {};
    updates[folderPath] = { type: folder.type, isLocked: true, lockedByFolder: undefined };
    this.#applyLockToFolderContents(currentFiles, updates, folderPath, [{path: folderPath, isFolder: true, chatDocumentId: ''}]); // Simuler le verrou pour applyLock

    this.files.set({ ...currentFiles, ...updates });

    try {
      await addLockedItem(folderPath, true); // Appel async à Appwrite
      logger.info(`Folder locked: ${folderPath} (Appwrite)`);
      return true;
    } catch (e) {
      logger.error(`Failed to lock folder ${folderPath} in Appwrite`, e);
      // Revert UI (plus complexe, il faudrait stocker l'état précédent de tous les fichiers affectés)
      // Pour l'instant, on laisse l'UI verrouillée et on log l'erreur.
      // Une meilleure solution serait de rafraîchir depuis Appwrite.
      await this.#loadLockedFiles(); // Tentative de resynchronisation
      return false;
    }
  }

  async unlockFile(filePath: string) { // chatId n'est plus nécessaire ici
    const file = this.getFile(filePath);
    if (!file) {
      logger.error(`Cannot unlock non-existent file: ${filePath}`);
      return false;
    }
    // Vérifier si le fichier est verrouillé par un dossier parent qui est toujours verrouillé
    const appwriteLocks = await getLockedItems();
    let parentStillLocks = false;
    let lockingParentPath: string | undefined = undefined;

    for (const lockedItem of appwriteLocks) {
        if (lockedItem.isFolder && filePath.startsWith(lockedItem.path + '/')) {
            parentStillLocks = true;
            lockingParentPath = lockedItem.path;
            break;
        }
    }

    this.files.setKey(filePath, { ...file, isLocked: parentStillLocks, lockedByFolder: lockingParentPath });

    try {
      // On tente de supprimer le verrou direct sur le fichier, même s'il est dans un dossier verrouillé.
      // C'est à la logique de `isLocked` de déterminer l'état final.
      await removeLockedItem(filePath); // Appel async à Appwrite
      logger.info(`File unlocked: ${filePath} (Appwrite attempt)`);
      // Recharger l'état des verrous pour refléter la vérité d'Appwrite
      await this.#loadLockedFiles();
      return true;
    } catch (e) {
      logger.error(`Failed to unlock file ${filePath} in Appwrite`, e);
      await this.#loadLockedFiles(); // Tentative de resynchronisation
      return false;
    }
  }

  async unlockFolder(folderPath: string) { // chatId n'est plus nécessaire ici
    const folder = this.getFileOrFolder(folderPath);
     if (!folder || folder.type !== 'folder') {
      logger.error(`Cannot unlock non-existent folder: ${folderPath}`);
      return false;
    }
    // Mettre à jour l'UI de manière optimiste pour le dossier lui-même
    // L'état des fichiers enfants sera corrigé par #loadLockedFiles
    const currentFiles = this.files.get();
    const updates: FileMap = {};
    updates[folderPath] = { type: folder.type, isLocked: false, lockedByFolder: undefined };
     // Déverrouiller en UI les enfants qui étaient verrouillés par CE dossier
    const folderPrefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    Object.entries(currentFiles).forEach(([itemPath, dirent]) => {
      if (itemPath.startsWith(folderPrefix) && dirent && dirent.lockedByFolder === folderPath) {
        updates[itemPath] = { ...(updates[itemPath] || dirent), isLocked: false, lockedByFolder: undefined };
      }
    });
    this.files.set({ ...currentFiles, ...updates });

    try {
      await removeLockedItem(folderPath); // Appel async à Appwrite
      logger.info(`Folder unlocked: ${folderPath} (Appwrite attempt)`);
      // Recharger l'état des verrous pour refléter la vérité d'Appwrite
      await this.#loadLockedFiles();
      return true;
    } catch (e) {
      logger.error(`Failed to unlock folder ${folderPath} in Appwrite`, e);
      await this.#loadLockedFiles(); // Tentative de resynchronisation
      return false;
    }
  }

  async isFileLocked(filePath: string): Promise<{ locked: boolean; lockedBy?: string }> {
    // Utilise la fonction d'Appwrite qui gère déjà les dossiers parents
    return await isFileLockedAppwrite(filePath);
  }

  // isFileInLockedFolder n'est plus directement utilisé ici, isFileLockedAppwrite s'en charge.
  // Si vous en avez absolument besoin séparément :
  /*
  async isFileInLockedFolder(filePath: string): Promise<{ locked: boolean; lockedBy?: string }> {
    // Vous devriez implémenter une logique similaire à celle de isFileLockedAppwrite
    // mais qui ne vérifie *que* les dossiers parents.
    // Ou appeler une fonction dédiée de lockedFiles.ts si vous l'ajoutez.
    const lockedItems = await getLockedItems();
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
  */

  async isFolderLocked(folderPath: string): Promise<{ isLocked: boolean; lockedBy?: string }> {
    // Utilise la fonction d'Appwrite
    const result = await isFolderLockedAppwrite(folderPath);
    return { isLocked: result.locked, lockedBy: result.lockedBy };
  }

  // ... getFile, getFileOrFolder, getFileModifications, getModifiedFiles, resetFileModifications, saveFile restent globalement les mêmes
  // mais doivent être `async` s'ils appellent des méthodes qui sont devenues `async`.

  getFile(filePath: string) {
    const dirent = this.files.get()[filePath];
    if (!dirent || dirent.type !== 'file') return undefined;
    return dirent;
  }

  getFileOrFolder(path: string) {
    return this.files.get()[path];
  }

  getFileModifications() {
    return computeFileModifications(this.files.get(), this.#modifiedFiles);
  }
  
  getModifiedFiles() {
    let modifiedFilesMap: { [path: string]: File } | undefined = undefined;
    for (const [filePath, originalContent] of this.#modifiedFiles) {
      const file = this.files.get()[filePath];
      if (file?.type !== 'file' || file.content === originalContent) continue;
      if (!modifiedFilesMap) modifiedFilesMap = {};
      modifiedFilesMap[filePath] = file;
    }
    return modifiedFilesMap;
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async saveFile(filePath: string, content: string) {
    // ... (logique interne reste la même)
    // Mais l'appel à `this.files.setKey` pour mettre à jour l'état `isLocked`
    // devrait peut-être être revu pour s'assurer qu'il reflète la vérité d'Appwrite.
    // Pour l'instant, on garde l'état isLocked précédent.
    const webcontainer = await this.#webcontainer;
    try {
      const relativePath = pathUtils.relative(webcontainer.workdir, filePath);
      if (!relativePath) throw new Error(`EINVAL: invalid file path, write '${relativePath}'`);
      const oldContent = this.getFile(filePath)?.content;
      if (oldContent === undefined && oldContent !== '') unreachable('Expected content to be defined');

      await webcontainer.fs.writeFile(relativePath, content);
      if (!this.#modifiedFiles.has(filePath)) {
        this.#modifiedFiles.set(filePath, oldContent || '');
      }
      const currentFileState = this.getFile(filePath);
      this.files.setKey(filePath, {
        type: 'file',
        content,
        isBinary: false,
        isLocked: currentFileState?.isLocked, // Conserver l'état de verrouillage actuel
        lockedByFolder: currentFileState?.lockedByFolder,
      });
      logger.info('File updated');
    } catch (error) {
      logger.error('Failed to update file content\n\n', error);
      throw error;
    }
  }


  async #init() {
    const webcontainer = await this.#webcontainer;
    this.#cleanupDeletedFiles();

    webcontainer.internal.watchPaths(
      { include: [`${WORK_DIR}/**`], exclude: ['**/node_modules', '.git'], includeContent: true },
      bufferWatchEvents(100, this.#processEventBuffer.bind(this)),
    );

    // migrateLegacyLocks(currentChatId); // SUPPRIMÉ
    await this.#loadLockedFiles(); // Devient async

    setTimeout(async () => { // Devient async
      await this.#loadLockedFiles();
    }, 2000);

    // clearCache(); // SUPPRIMÉ
    // Le polling régulier pour #loadLockedFiles peut toujours être utile comme fallback
    // si la détection de changement de chat ou les mises à jour Appwrite Realtime (non implémentées ici)
    // ne sont pas parfaites.
    setInterval(async () => { // Devient async
      // clearCache(); // SUPPRIMÉ
      await this.#loadLockedFiles();
    }, 30000);
  }

  // ... (#cleanupDeletedFiles, #processEventBuffer, #decodeFileContent, createFile, createFolder, deleteFile, deleteFolder, #persistDeletedPaths)
  // Ces méthodes doivent être revues pour s'assurer qu'elles gèrent correctement l'état `isLocked` et `lockedByFolder`
  // et qu'elles n'interfèrent pas négativement avec la synchronisation depuis Appwrite.
  // Par exemple, lors de la création d'un fichier, son état `isLocked` initial devrait être `false`
  // à moins que son dossier parent ne soit déjà verrouillé.

  #cleanupDeletedFiles() {
    if (this.#deletedPaths.size === 0) return;
    const currentFiles = this.files.get();
    const pathsToDeleteFromStore = new Set<string>();
    const deletedPrefixes = [...this.#deletedPaths].map((p) => p + '/');

    for (const [itemPath, dirent] of Object.entries(currentFiles)) {
      if (!dirent) continue;
      if (this.#deletedPaths.has(itemPath)) {
        pathsToDeleteFromStore.add(itemPath);
        continue;
      }
      for (const prefix of deletedPrefixes) {
        if (itemPath.startsWith(prefix)) {
          pathsToDeleteFromStore.add(itemPath);
          break;
        }
      }
    }
    if (pathsToDeleteFromStore.size > 0) {
      const updates: FileMap = {};
      for (const pathToDelete of pathsToDeleteFromStore) {
        const dirent = currentFiles[pathToDelete];
        updates[pathToDelete] = undefined;
        if (dirent?.type === 'file') {
          this.#size--;
          if (this.#modifiedFiles.has(pathToDelete)) {
            this.#modifiedFiles.delete(pathToDelete);
          }
        }
      }
      this.files.set({ ...currentFiles, ...updates });
    }
  }

  #processEventBuffer(events: Array<[events: PathWatcherEvent[]]>) {
    const watchEvents = events.flat(2);
    const newUpdates: FileMap = {}; // Accumuler les mises à jour

    for (const { type, path: eventPath, buffer } of watchEvents) {
      const sanitizedPath = eventPath.replace(/\/+$/g, '');
      switch (type) {
        case 'add_dir':
          newUpdates[sanitizedPath] = { type: 'folder', isLocked: false, lockedByFolder: undefined }; // Initialiser avec état non verrouillé
          break;
        case 'remove_dir':
          newUpdates[sanitizedPath] = undefined;
          for (const [direntPath] of Object.entries(this.files.get())) { // Utiliser get() pour l'état actuel
            if (direntPath.startsWith(sanitizedPath + '/')) { // Ajouter / pour s'assurer que c'est bien un sous-dossier
              newUpdates[direntPath] = undefined;
            }
          }
          break;
        case 'add_file':
        case 'change': {
          if (type === 'add_file') this.#size++;
          let content = '';
          const isBinary = isBinaryFile(buffer);
          if (!isBinary) content = this.#decodeFileContent(buffer);
          newUpdates[sanitizedPath] = { type: 'file', content, isBinary, isLocked: false, lockedByFolder: undefined }; // Initialiser
          break;
        }
        case 'remove_file':
          this.#size--;
          newUpdates[sanitizedPath] = undefined;
          break;
        case 'update_directory':
          break;
      }
    }
     if (Object.keys(newUpdates).length > 0) {
        this.files.set({ ...this.files.get(), ...newUpdates });
        // Après avoir traité les événements du watcher, recharger les verrous pour s'assurer que l'état est correct
        // Cela peut être un peu lourd, une approche plus fine serait de vérifier le verrouillage
        // uniquement pour les nouveaux fichiers/dossiers ajoutés.
        this.#loadLockedFiles();
    }
  }

   #decodeFileContent(buffer?: Uint8Array) {
    if (!buffer || buffer.byteLength === 0) return '';
    try {
      return utf8TextDecoder.decode(buffer);
    } catch (error) {
      logger.warn('Failed to decode file content as UTF-8, possibly binary or corrupted.', error);
      return ''; // Ou retourner une indication de contenu binaire/corrompu
    }
  }

  async createFile(filePath: string, content: string | Uint8Array = '') {
    const webcontainer = await this.#webcontainer;
    try {
      const relativePath = pathUtils.relative(webcontainer.workdir, filePath);
      if (!relativePath) throw new Error(`EINVAL: invalid file path, create '${relativePath}'`);
      const dirPath = pathUtils.dirname(relativePath);
      if (dirPath !== '.' && dirPath !== '') await webcontainer.fs.mkdir(dirPath, { recursive: true });

      const isBinary = content instanceof Uint8Array;
      // Déterminer l'état de verrouillage initial basé sur les dossiers parents
      const lockState = await this.isFileLocked(filePath); // Vérifie si un parent le verrouille déjà

      if (isBinary) {
        await webcontainer.fs.writeFile(relativePath, Buffer.from(content));
        const base64Content = Buffer.from(content).toString('base64');
        this.files.setKey(filePath, { type: 'file', content: base64Content, isBinary: true, isLocked: lockState.locked, lockedByFolder: lockState.lockedBy });
        this.#modifiedFiles.set(filePath, base64Content);
      } else {
        const contentToWrite = (content as string).length === 0 ? '' : content as string; // Permettre contenu vide
        await webcontainer.fs.writeFile(relativePath, contentToWrite);
        this.files.setKey(filePath, { type: 'file', content: contentToWrite, isBinary: false, isLocked: lockState.locked, lockedByFolder: lockState.lockedBy });
        this.#modifiedFiles.set(filePath, contentToWrite);
      }
      logger.info(`File created: ${filePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to create file\n\n', error);
      throw error;
    }
  }

  async createFolder(folderPath: string) {
    const webcontainer = await this.#webcontainer;
    try {
      const relativePath = pathUtils.relative(webcontainer.workdir, folderPath);
      if (!relativePath) throw new Error(`EINVAL: invalid folder path, create '${relativePath}'`);
      await webcontainer.fs.mkdir(relativePath, { recursive: true });
      const lockState = await this.isFolderLocked(folderPath); // Vérifie si un parent le verrouille
      this.files.setKey(folderPath, { type: 'folder', isLocked: lockState.isLocked, lockedByFolder: lockState.lockedBy });
      logger.info(`Folder created: ${folderPath}`);
      return true;
    } catch (error) {
      logger.error('Failed to create folder\n\n', error);
      throw error;
    }
  }

  async deleteFile(filePath: string) {
    const webcontainer = await this.#webcontainer;
    try {
      const relativePath = pathUtils.relative(webcontainer.workdir, filePath);
      if (!relativePath) throw new Error(`EINVAL: invalid file path, delete '${relativePath}'`);
      await webcontainer.fs.rm(relativePath);
      this.#deletedPaths.add(filePath);
      this.files.setKey(filePath, undefined);
      this.#size--;
      if (this.#modifiedFiles.has(filePath)) this.#modifiedFiles.delete(filePath);
      // Aussi supprimer le verrou d'Appwrite si ce fichier était directement verrouillé
      await removeLockedItem(filePath);
      this.#persistDeletedPaths();
      logger.info(`File deleted: ${filePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete file\n\n', error);
      throw error;
    }
  }

  async deleteFolder(folderPath: string) {
    const webcontainer = await this.#webcontainer;
    try {
      const relativePath = pathUtils.relative(webcontainer.workdir, folderPath);
      if (!relativePath) throw new Error(`EINVAL: invalid folder path, delete '${relativePath}'`);
      await webcontainer.fs.rm(relativePath, { recursive: true });
      this.#deletedPaths.add(folderPath);
      this.files.setKey(folderPath, undefined);
      const allFiles = this.files.get();
      for (const [itemPath, dirent] of Object.entries(allFiles)) {
        if (itemPath.startsWith(folderPath + '/')) {
          this.files.setKey(itemPath, undefined);
          this.#deletedPaths.add(itemPath);
          if (dirent?.type === 'file') {
            this.#size--;
            if (this.#modifiedFiles.has(itemPath)) this.#modifiedFiles.delete(itemPath);
            // Supprimer le verrou Appwrite si le sous-fichier était directement verrouillé
            await removeLockedItem(itemPath);
          } else if (dirent?.type === 'folder') {
             // Supprimer le verrou Appwrite si le sous-dossier était directement verrouillé
            await removeLockedItem(itemPath);
          }
        }
      }
      // Supprimer le verrou Appwrite pour le dossier lui-même
      await removeLockedItem(folderPath);
      this.#persistDeletedPaths();
      logger.info(`Folder deleted: ${folderPath}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete folder\n\n', error);
      throw error;
    }
  }

  #persistDeletedPaths() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('bolt-deleted-paths', JSON.stringify([...this.#deletedPaths]));
      }
    } catch (error) {
      logger.error('Failed to persist deleted paths to localStorage', error);
    }
  }

} // Fin de la classe FilesStore

function isBinaryFile(buffer: Uint8Array | undefined) {
  if (buffer === undefined) return false;
  return getEncoding(convertToBuffer(buffer), { chunkLength: 100 }) === 'binary';
}

function convertToBuffer(view: Uint8Array): Buffer {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}
