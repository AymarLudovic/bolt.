// useChatHistory.ts
import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import { generateId, type JSONValue, type Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs';
import {
  getMessages,
  // getNextId, // Remplacé par generateNewChatId ou ID.unique()
  generateNewChatId,
  getUrlId,
  // openDatabase, // Remplacé par l'initialisation Appwrite
  setMessages,
  duplicateChat,
  createChatFromMessages,
  getSnapshot,
  setSnapshot,
  updateChatMetadata as dbUpdateChatMetadata, // Renommer pour éviter conflit
  type IChatMetadata,
} from './db'; // db.ts modifié
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot } from './types';
import { webcontainer } from '~/lib/webcontainer';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';
import { databases, getAppwriteSession } from '~/lib/appwrite'; // Importer databases et getAppwriteSession

export interface ChatHistoryItem {
  id: string; // Notre chatId métier
  appwriteDocumentId?: string; // ID du document Appwrite
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE && !!databases;

// export const db = persistenceEnabled ? await openDatabase() : undefined; // Ancienne logique
// L'instance `databases` d'Appwrite est maintenant globale et initialisée dans lib/appwrite.ts

export const chatIdAtom = atom<string | undefined>(undefined); // Renommé pour éviter conflit avec chatId variable
export const chatAppwriteDocumentIdAtom = atom<string | undefined>(undefined); // Pour stocker l'ID du doc Appwrite
export const descriptionAtom = atom<string | undefined>(undefined);
export const chatMetadataAtom = atom<IChatMetadata | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedIdFromLoader } = useLoaderData<{ id?: string }>(); // Peut être chatId ou urlId
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [currentUrlId, setCurrentUrlId] = useState<string | undefined>(); // Renommé pour clarté

  useEffect(() => {
    async function initAndLoad() {
      if (!persistenceEnabled || !databases) {
        setReady(true);
        if (persistenceEnabled) { // Signifie que databases était null, donc problème de config
          const error = new Error('Chat persistence with Appwrite is unavailable (config issue).');
          logStore.logError('Appwrite persistence initialization failed', error);
          toast.error('Chat persistence is unavailable.');
        }
        return;
      }

      try {
        await getAppwriteSession(); // S'assurer que la session est prête
      } catch (e) {
        setReady(true);
        logStore.logError('Appwrite session failed', e as Error);
        toast.error('Chat persistence session failed.');
        return;
      }

      if (mixedIdFromLoader) {
        try {
          const storedChat = await getMessages(mixedIdFromLoader); // Utilise la nouvelle fonction getMessages
          
          if (storedChat && storedChat.messages.length > 0 && storedChat.appwriteDocumentId) {
            const appwriteDocId = storedChat.appwriteDocumentId;
            const snapshot = await getSnapshot(appwriteDocId); // Fetch snapshot using Appwrite doc ID

            const validSnapshot = snapshot || { chatIndex: '', files: {} };
            const summary = validSnapshot.summary;

            // ... (logique de rewindTo et snapshot existante, qui devrait fonctionner)
            // Assurez-vous que storedMessages.messages est bien `storedChat.messages`
            // et que `storedMessages.messages[snapshotIndex].id` est bien `storedChat.messages[snapshotIndex].id`

            let filteredMessages = storedChat.messages; // Ajustez selon la logique de snapshot
            let currentArchivedMessages: Message[] = []; // idem

            const rewindId = searchParams.get('rewindTo');
            let startingIdx = -1;
            const endingIdx = rewindId
              ? storedChat.messages.findIndex((m) => m.id === rewindId) + 1
              : storedChat.messages.length;
            const snapshotIndex = storedChat.messages.findIndex((m) => m.id === validSnapshot.chatIndex);

            if (snapshotIndex >= 0 && snapshotIndex < endingIdx) {
              startingIdx = snapshotIndex;
            }

            if (snapshotIndex > 0 && storedChat.messages[snapshotIndex].id == rewindId) {
              startingIdx = -1;
            }

            filteredMessages = storedChat.messages.slice(startingIdx + 1, endingIdx);

            if (startingIdx >= 0) {
              currentArchivedMessages = storedChat.messages.slice(0, startingIdx + 1);
            }

            setArchivedMessages(currentArchivedMessages);

            if (startingIdx > 0 && snapshot) { // Assurez-vous que snapshot existe pour la restauration
              const files = Object.entries(validSnapshot?.files || {})
                .map(([key, value]) => {
                  if (value?.type !== 'file') return null;
                  return { content: value.content, path: key };
                })
                .filter((x): x is { content: string; path: string } => !!x);
              const projectCommands = await detectProjectCommands(files);
              const commandActionsString = createCommandActionsString(projectCommands);

              filteredMessages = [
                { id: generateId(), role: 'user', content: `Restore project from snapshot`, annotations: ['no-store', 'hidden'] },
                {
                  id: storedChat.messages[snapshotIndex].id,
                  role: 'assistant',
                  content: `Bolt Restored your chat from a snapshot. You can revert this message to load the full chat history.
                  <boltArtifact id="restored-project-setup" title="Restored Project & Setup" type="bundled">
                  ${Object.entries(snapshot?.files || {}).map(([key, value]) => {
                    if (value?.type === 'file') {
                      return `<boltAction type="file" filePath="${key}">${value.content}</boltAction>`;
                    }
                    return ``;
                  }).join('\n')}
                  ${commandActionsString} 
                  </boltArtifact>`,
                  annotations: [
                    'no-store',
                    ...(summary ? [{ chatId: storedChat.messages[snapshotIndex].id, type: 'chatSummary', summary } as ContextAnnotation] : []),
                  ],
                },
                ...filteredMessages,
              ];
              // On passe l'ID du document Appwrite à restoreSnapshot si nécessaire, ou le snapshot lui-même.
              // La fonction restoreSnapshot actuelle prend l'ID du chat (métier ou urlId) et refait un getSnapshot.
              // On peut optimiser en passant directement le snapshot chargé.
              restoreSnapshot(storedChat.id, snapshot); 
            }
            // FIN logique snapshot
            
            setInitialMessages(filteredMessages);
            setCurrentUrlId(storedChat.urlId);
            descriptionAtom.set(storedChat.description);
            chatIdAtom.set(storedChat.id); // Notre ID métier
            chatAppwriteDocumentIdAtom.set(appwriteDocId); // ID du document Appwrite
            chatMetadataAtom.set(storedChat.metadata);
          } else {
            navigate('/', { replace: true });
          }
          setReady(true);
        } catch (error) {
          console.error(error);
          logStore.logError('Failed to load chat messages or snapshot from Appwrite', error as Error);
          toast.error('Failed to load chat: ' + (error as Error).message);
          setReady(true); // Important pour débloquer l'UI même en cas d'erreur
          // Peut-être naviguer vers / si le chargement échoue ?
          // navigate('/', { replace: true });
        }
      } else {
        // Nouveau chat
        chatIdAtom.set(undefined);
        chatAppwriteDocumentIdAtom.set(undefined);
        descriptionAtom.set(undefined);
        chatMetadataAtom.set(undefined);
        setCurrentUrlId(undefined);
        setInitialMessages([]);
        setArchivedMessages([]);
        setReady(true);
      }
    }
    initAndLoad();
  }, [mixedIdFromLoader, navigate, searchParams]); // `databases` n'est pas une dépendance car c'est une instance stable

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatUrlIdOrChatId?: string | undefined, chatSummary?: string) => {
      const currentChatAppwriteDocId = chatAppwriteDocumentIdAtom.get();
      if (!currentChatAppwriteDocId || !persistenceEnabled) return;

      const snapshotToSave: Snapshot = { chatIndex: chatIdx, files, summary: chatSummary };
      try {
        await setSnapshot(currentChatAppwriteDocId, snapshotToSave); // Utilise l'ID du document Appwrite
      } catch (error) {
        console.error('Failed to save snapshot to Appwrite:', error);
        toast.error('Failed to save chat snapshot.');
      }
    },
    [persistenceEnabled], // `databases` est stable
  );

  const restoreSnapshot = useCallback(async (chatIdToRestore: string, snapshotData?: Snapshot) => {
    const container = await webcontainer;
    let effectiveSnapshot = snapshotData;

    if (!effectiveSnapshot) { // Si non fourni, essayez de le récupérer
        const chat = await getMessages(chatIdToRestore); // Peut être urlId ou chatId métier
        if (chat && chat.appwriteDocumentId) {
            effectiveSnapshot = await getSnapshot(chat.appwriteDocumentId);
        }
    }
    
    const validSnapshot = effectiveSnapshot || { chatIndex: '', files: {} };
    if (!validSnapshot?.files) return;

    // ... (logique de restauration des fichiers dans webcontainer, reste identique)
    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (key.startsWith(container.workdir)) {
        key = key.replace(container.workdir, '');
      }
      if (value?.type === 'folder') {
        await container.fs.mkdir(key, { recursive: true });
      }
    });
    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (value?.type === 'file') {
        if (key.startsWith(container.workdir)) {
          key = key.replace(container.workdir, '');
        }
        await container.fs.writeFile(key, value.content, { encoding: value.isBinary ? undefined : 'utf8' });
      }
    });
  }, []);


  return {
    ready: ready, // mixedIdFromLoader n'est plus nécessaire ici si ready est bien géré
    initialMessages,
    archivedMessages, // Exposer si nécessaire pour la logique de rendu
    updateChatMetaData: async (metadata: IChatMetadata) => {
      const currentChatId = chatIdAtom.get(); // Notre ID métier
      const currentAppwriteDocId = chatAppwriteDocumentIdAtom.get();
      if (!persistenceEnabled || !currentChatId || !currentAppwriteDocId) return;

      try {
        // dbUpdateChatMetadata attend l'ID (métier ou urlId) pour retrouver le chat.
        // On pourrait aussi créer une fonction dans db.ts qui prend directement appwriteDocumentId
        // et les métadonnées pour éviter un getMessages.
        // Pour l'instant, on utilise l'existant.
        const chatToUpdate = await getMessages(currentChatId); // Récupère le chat complet
        if (!chatToUpdate) throw new Error("Chat not found for metadata update");

        await setMessages(
            currentChatId,
            [...archivedMessages, ...initialMessages], // Utiliser les messages actuels
            currentUrlId,
            descriptionAtom.get(),
            undefined, // timestamp
            metadata,
            currentAppwriteDocId // ID du document Appwrite pour update
        );
        chatMetadataAtom.set(metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      if (!persistenceEnabled || messages.length === 0) return;

      const { firstArtifact } = workbenchStore;
      const filteredMessages = messages.filter((m) => !m.annotations?.includes('no-store'));
      if (filteredMessages.length === 0 && archivedMessages.length === 0 && initialMessages.length === 0) return; // Ne rien sauvegarder si tout est vide après filtrage

      let finalChatId = chatIdAtom.get();
      let finalAppwriteDocId = chatAppwriteDocumentIdAtom.get();
      let finalUrlId = currentUrlId;

      if (!finalChatId) { // Nouveau chat
        finalChatId = await generateNewChatId(); // Génère notre ID métier
        chatIdAtom.set(finalChatId);
        // L'ID du document Appwrite sera créé par setMessages
      }

      if (!finalUrlId && firstArtifact?.id) {
        const newUrlId = await getUrlId(firstArtifact.id);
        finalUrlId = newUrlId;
        setCurrentUrlId(newUrlId);
        if (finalChatId) navigateChat(newUrlId); // Navigue si on a un ID de chat
      } else if (!finalUrlId && finalChatId) {
        // Si toujours pas d'urlId mais on a un chatId, on en génère un basé sur le chatId
        const newUrlId = await getUrlId(finalChatId.substring(0,8));
        finalUrlId = newUrlId;
        setCurrentUrlId(newUrlId);
        navigateChat(newUrlId);
      }


      let chatSummary: string | undefined = undefined;
      const lastMessage = filteredMessages[filteredMessages.length - 1];
      if (lastMessage?.role === 'assistant') {
        // ... (logique existante pour extraire chatSummary)
         const annotations = lastMessage.annotations as JSONValue[];
        const filteredAnnotations = (annotations?.filter(
          (annotation: JSONValue) =>
            annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
        ) || []) as { type: string; value: any } & { [key: string]: any }[];

        if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
          chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
        }
      }
      
      // `takeSnapshot` attend l'ID du document Appwrite
      if (finalAppwriteDocId && filteredMessages.length > 0) { // S'assurer qu'il y a un message pour l'index
          takeSnapshot(filteredMessages[filteredMessages.length - 1].id, workbenchStore.files.get(), undefined, chatSummary);
      } else if (!finalAppwriteDocId && filteredMessages.length > 0 && finalChatId) {
          // Si c'est un nouveau chat, le snapshot sera pris après la première sauvegarde qui crée le document.
          // On pourrait stocker temporairement le snapshot et l'associer après la création du document.
          // Pour l'instant, le snapshot ne sera pas pris pour le tout premier message d'un nouveau chat
          // avant que `finalAppwriteDocId` ne soit défini.
          // Ou alors, on fait un premier `setMessages` pour créer le doc, puis `takeSnapshot`.
          console.warn("Snapshot not taken for the first message of a new chat until Appwrite document ID is available.");
      }


      if (!descriptionAtom.get() && firstArtifact?.title) {
        descriptionAtom.set(firstArtifact?.title);
      }

      try {
        const newAppwriteDocId = await setMessages(
          finalChatId, // Notre ID métier
          [...archivedMessages, ...filteredMessages], // Combinaison des messages
          finalUrlId,
          descriptionAtom.get(),
          undefined, // timestamp, Appwrite le gère
          chatMetadataAtom.get(),
          finalAppwriteDocId // ID du document Appwrite pour update, ou undefined pour création
        );
        if (!finalAppwriteDocId) {
            chatAppwriteDocumentIdAtom.set(newAppwriteDocId); // Stocker le nouvel ID de document
            // Maintenant qu'on a l'ID du document, on peut prendre le snapshot si ce n'est pas fait
            if (filteredMessages.length > 0) {
                 takeSnapshot(filteredMessages[filteredMessages.length - 1].id, workbenchStore.files.get(), undefined, chatSummary);
            }
        }
        // Mettre à jour initialMessages pour refléter l'état sauvegardé
        setInitialMessages(filteredMessages);

      } catch (error) {
        console.error('Cannot save messages to Appwrite, chat ID or Appwrite Document ID might be missing or other error.', error);
        toast.error('Failed to save chat messages: ' + (error as Error).message);
      }
    },
    duplicateCurrentChat: async (listItemId: string) => { // listItemId est chatId ou urlId
      if (!persistenceEnabled) return;
      const idToDup = mixedIdFromLoader || listItemId;
      if (!idToDup) return;

      try {
        // duplicateChat de db.ts retourne le nouveau urlId
        const newUrlId = await duplicateChat(idToDup);
        navigate(`/chat/${newUrlId}`); // Naviguer vers le nouveau chat
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat: ' + (error as Error).message);
        console.log(error);
      }
    },
    importChat: async (chatDescription: string, messages: Message[], metadata?: IChatMetadata) => {
      if (!persistenceEnabled) return;
      try {
        // createChatFromMessages de db.ts retourne le nouveau urlId
        const newUrlId = await createChatFromMessages(chatDescription, messages, metadata);
        // navigate(`/chat/${newUrlId}`); // Plutôt que window.location.href pour une SPA
        window.location.href = `/chat/${newUrlId}`; // Garder le comportement original pour l'instant
        toast.success('Chat imported successfully');
      } catch (error) {
        toast.error('Failed to import chat: ' + (error as Error).message);
      }
    },
    exportChat: async (idToExport = currentUrlId) => { // idToExport peut être urlId ou chatId
      if (!persistenceEnabled || !idToExport) return;

      try {
        const chat = await getMessages(idToExport); // Utilise la nouvelle fonction
        if (!chat) {
          toast.error('Chat not found for export');
          return;
        }
        const chatData = {
          messages: chat.messages,
          description: chat.description,
          metadata: chat.metadata, // Exporter aussi les métadonnées
          exportDate: new Date().toISOString(),
          // On pourrait ajouter urlId et id (chatId métier) si utile
        };

        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${chat.description || chat.id}-${new Date().toISOString().substring(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
          toast.error('Failed to export chat: ' + (error as Error).message);
          console.error(error);
      }
    },
  };
}

function navigateChat(nextId: string) { // nextId est généralement urlId
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;
  window.history.replaceState({}, '', url);
}
