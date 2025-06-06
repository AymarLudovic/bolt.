// useEditChatDescription.ts
import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
// Anciens imports de ~/lib/persistence :
// import {
//   chatId as chatIdStore,
//   db,
//   description as descriptionStore,
//   getMessages,
//   updateChatDescription,
// } from '~/lib/persistence';

// Nouveaux imports
import {
    chatIdAtom, // L'atome pour l'ID du chat courant
    descriptionAtom, // L'atome pour la description globale du chat courant
    // db n'est plus utilisé ici directement
} from '~/lib/persistence/useChatHistory'; // Source des atomes d'état du chat

import {
    getMessages as appwriteGetMessages, // Fonction pour récupérer les messages/chat depuis Appwrite
    updateChatDescription as appwriteUpdateChatDescription, // Fonction pour mettre à jour la description dans Appwrite
} from '~/lib/persistence/db'; // Source des opérations DB Appwrite
import { databases as appwriteDatabases } from '~/lib/appwrite'; // Pour vérifier si Appwrite est prêt

interface EditChatDescriptionOptions {
  initialDescription?: string; // Peut être passé ou lu depuis descriptionAtom
  customChatId?: string; // ID du chat à modifier, si différent du chat courant global
  syncWithGlobalStore?: boolean; // Pour mettre à jour descriptionAtom après succès
}

type EditChatDescriptionHook = {
  editing: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => Promise<void>;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => Promise<void>;
  currentDescription: string;
  toggleEditMode: () => void;
};

export function useEditChatDescription({
  initialDescription: initialDescriptionProp, // Renommé pour éviter conflit avec l'atome
  customChatId,
  syncWithGlobalStore,
}: EditChatDescriptionOptions): EditChatDescriptionHook {
  const globalChatIdFromStore = useStore(chatIdAtom);
  const globalDescriptionFromStore = useStore(descriptionAtom);

  const effectiveInitialDescription = initialDescriptionProp ?? globalDescriptionFromStore ?? '';

  const [editing, setEditing] = useState(false);
  const [currentDescription, setCurrentDescription] = useState(effectiveInitialDescription);

  // Déterminer le chatId à utiliser : customChatId a la priorité, sinon celui du store global
  const chatIdToUse = customChatId || globalChatIdFromStore;

  useEffect(() => {
    // Si on n'est pas en mode édition et que la description globale change (et qu'on doit synchroniser)
    // OU si initialDescriptionProp change, on met à jour l'état local.
    if (!editing) {
        setCurrentDescription(initialDescriptionProp ?? globalDescriptionFromStore ?? '');
    }
  }, [initialDescriptionProp, globalDescriptionFromStore, editing]);


  const toggleEditMode = useCallback(() => {
    setEditing((prev) => {
        if (prev) { // Si on quitte le mode édition
            // Réinitialiser à la description actuelle (globale ou prop)
            setCurrentDescription(initialDescriptionProp ?? globalDescriptionFromStore ?? '');
        }
        return !prev;
    });
  }, [initialDescriptionProp, globalDescriptionFromStore]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentDescription(e.target.value);
  }, []);

  const fetchLatestDescription = useCallback(async () => {
    if (!appwriteDatabases || !chatIdToUse) { // Vérifier si Appwrite est prêt et si on a un ID
      return effectiveInitialDescription;
    }
    try {
      // appwriteGetMessages prend l'ID du chat (métier ou urlId)
      const chat = await appwriteGetMessages(chatIdToUse);
      return chat?.description || effectiveInitialDescription;
    } catch (error) {
      console.error('Failed to fetch latest description from Appwrite:', error);
      return effectiveInitialDescription;
    }
  }, [appwriteDatabases, chatIdToUse, effectiveInitialDescription]);

  const handleBlur = useCallback(async () => {
    // Si on quitte le mode édition sans soumettre, réinitialiser la description.
    if (editing) {
        const latestDescription = await fetchLatestDescription();
        setCurrentDescription(latestDescription);
        setEditing(false); // Quitter le mode édition
    }
  }, [editing, fetchLatestDescription, setEditing, setCurrentDescription]);


  const isValidDescription = useCallback((desc: string): boolean => {
    const trimmedDesc = desc.trim();
    const actualInitialDesc = initialDescriptionProp ?? globalDescriptionFromStore ?? '';

    if (trimmedDesc === actualInitialDesc && editing) { // Ne pas valider si pas de changement et qu'on quitte le mode
      // toggleEditMode(); // Déjà géré par handleSubmit ou handleBlur
      return false; 
    }

    const lengthValid = trimmedDesc.length > 0 && trimmedDesc.length <= 100;
    const characterValid = /^[a-zA-Z0-9\s\-_.,!?()[\]{}'"]+$/.test(trimmedDesc);

    if (!lengthValid) {
      toast.error('Description must be between 1 and 100 characters.');
      return false;
    }
    if (!characterValid) {
      toast.error('Description can only contain letters, numbers, spaces, and basic punctuation.');
      return false;
    }
    return true;
  }, [initialDescriptionProp, globalDescriptionFromStore, editing]);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => { // event est optionnel
      if (event) event.preventDefault();

      if (!isValidDescription(currentDescription)) {
        // Si la description n'est pas valide (par ex. identique à l'initiale mais on a soumis),
        // on quitte le mode édition sans rien faire de plus.
        // La validation elle-même (toast.error) est déjà gérée dans isValidDescription.
        // On s'assure de réinitialiser la description à l'état "connu" avant de quitter.
        const latestValidDesc = await fetchLatestDescription();
        setCurrentDescription(latestValidDesc);
        setEditing(false);
        return;
      }

      if (!appwriteDatabases) {
        toast.error('Data service (Appwrite) is not available');
        return;
      }
      if (!chatIdToUse) {
        toast.error('Chat ID is not available to update description');
        return;
      }

      try {
        // appwriteUpdateChatDescription prend l'ID du chat et la nouvelle description
        await appwriteUpdateChatDescription(chatIdToUse, currentDescription);

        if (syncWithGlobalStore && (customChatId ? customChatId === globalChatIdFromStore : true) ) {
          // Mettre à jour l'atome global seulement si on modifie le chat global
          // ou si on synchronise et que customChatId correspond au chat global.
          descriptionAtom.set(currentDescription);
        }
        toast.success('Chat description updated successfully');
      } catch (error) {
        toast.error('Failed to update chat description: ' + (error instanceof Error ? error.message : 'Unknown error'));
        // En cas d'erreur, réinitialiser à la description d'avant la tentative de modif
        setCurrentDescription(initialDescriptionProp ?? globalDescriptionFromStore ?? '');
      } finally {
        setEditing(false);
      }
    },
    [
        currentDescription,
        isValidDescription,
        appwriteDatabases,
        chatIdToUse,
        syncWithGlobalStore,
        descriptionAtom,
        fetchLatestDescription,
        initialDescriptionProp,
        globalDescriptionFromStore,
        customChatId, // Ajouté pour la condition de syncWithGlobalStore
        globalChatIdFromStore // Ajouté pour la condition de syncWithGlobalStore
    ]
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault(); // Empêcher d'autres handlers (par ex. fermeture de modale)
        const latestDescription = await fetchLatestDescription(); // Récupérer la dernière bonne description
        setCurrentDescription(latestDescription);
        setEditing(false); // Quitter le mode édition
      } else if (e.key === 'Enter') {
        e.preventDefault();
        await handleSubmit(); // Soumettre le formulaire
      }
    },
    [fetchLatestDescription, handleSubmit], // handleSubmit est déjà un useCallback
  );

  return {
    editing,
    handleChange,
    handleBlur,
    handleSubmit,
    handleKeyDown,
    currentDescription,
    toggleEditMode,
  };
}
