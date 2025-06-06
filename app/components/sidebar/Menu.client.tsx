// Menu.client.tsx
import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { SettingsButton } from '~/components/ui/SettingsButton';
import { Button } from '~/components/ui/Button';

import {
    chatIdAtom,
    type ChatHistoryItem,
    useChatHistory
} from '~/lib/persistence/useChatHistory';

import {
    deleteById as appwriteDeleteById,
    getAll as appwriteGetAll,
} from '~/lib/persistence/db';
import { databases as appwriteDatabases, getAppwriteSession } from '~/lib/appwrite';

import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { SiSafari } from 'react-icons/si';

const menuVariants = {
  closed: { opacity: 0, visibility: 'hidden' as 'hidden', left: '-340px', transition: { duration: 0.2, ease: cubicEasingFn }},
  open: { opacity: 1, visibility: 'visible' as 'visible', left: 0, transition: { duration: 0.2, ease: cubicEasingFn }},
} satisfies Variants;

type DialogContentType =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] };
type DialogState = DialogContentType | null;

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogState>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = useStore(profileStore);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isAppwriteLoading, setIsAppwriteLoading] = useState(true);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(async () => {
    if (appwriteDatabases) {
      setIsAppwriteLoading(true);
      console.log('Menu.client: loadEntries - Appwrite DB available, attempting to load.');
      try {
        await getAppwriteSession();
        console.log('Menu.client: loadEntries - Appwrite session obtained.');
        const chatList = await appwriteGetAll(); // Cette fonction vient de db.ts
        console.log('Menu.client: loadEntries - Raw chatList from appwriteGetAll:', JSON.parse(JSON.stringify(chatList))); // Log глубокой копии

        if (!Array.isArray(chatList)) {
            console.error('Menu.client: loadEntries - appwriteGetAll did not return an array!', chatList);
            setList([]);
            toast.error('Failed to load chat structure.');
            return;
        }

        const itemsBeforeFilter = chatList.length;
        const filteredChatList = chatList.filter(item => {
            const hasUrlId = !!item.urlId; // Vérifie si urlId existe et n'est pas une chaîne vide
            const hasDescription = !!item.description; // Vérifie si description existe et n'est pas une chaîne vide
            if (!hasUrlId || !hasDescription) {
                console.warn('Menu.client: loadEntries - Filtering out item due to missing urlId or description:', JSON.parse(JSON.stringify(item)));
            }
            return hasUrlId && hasDescription;
        });
        const itemsAfterFilter = filteredChatList.length;

        console.log(`Menu.client: loadEntries - Items before filter: ${itemsBeforeFilter}, Items after filter: ${itemsAfterFilter}`);
        setList(filteredChatList);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load chat history';
        toast.error(errorMessage);
        console.error("Menu.client: loadEntries - Error loading entries from Appwrite:", error);
        setList([]); // Réinitialiser la liste en cas d'erreur
      } finally {
        setIsAppwriteLoading(false);
      }
    } else {
        toast.warn("Data service not available. Cannot load chat entries.");
        console.warn("Menu.client: loadEntries - Appwrite DB not available.");
        setIsAppwriteLoading(false);
        setList([]); // Réinitialiser la liste
    }
  }, []); // loadEntries ne dépend que de appwriteDatabases qui est stable après init

  // ... (le reste de vos fonctions deleteChat, deleteItem, etc. reste identique pour l'instant)
  const deleteChat = useCallback(
    async (itemToDelete: ChatHistoryItem): Promise<void> => {
      if (!appwriteDatabases) throw new Error('Data service not available');
      if (!itemToDelete.appwriteDocumentId) {
          console.error("Cannot delete chat: Appwrite document ID is missing.", itemToDelete);
          throw new Error("Appwrite document ID missing for chat deletion.");
      }
      await appwriteDeleteById(itemToDelete.appwriteDocumentId, itemToDelete.id);
      console.log('Successfully deleted chat from Appwrite:', itemToDelete.id);
    },
    [],
  );

  const deleteItem = useCallback(
    async (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await deleteChat(item);
        toast.success('Chat deleted successfully');
        await loadEntries(); // Recharger après succès
        if (chatIdAtom.get() === item.id) {
          window.location.pathname = '/';
        }
      } catch (error) {
        console.error('Failed to delete chat:', error);
        toast.error('Failed to delete conversation: ' + (error instanceof Error ? error.message : "Unknown error"));
        await loadEntries(); // Recharger même en cas d'erreur
      }
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteArg: ChatHistoryItem[]) => {
      if (!appwriteDatabases || itemsToDeleteArg.length === 0) return;
      let deletedCount = 0;
      const errors: string[] = [];
      const currentGlobalChatId = chatIdAtom.get();
      let shouldNavigate = false;

      for (const item of itemsToDeleteArg) {
        try {
          if (!item.appwriteDocumentId) {
              errors.push(item.id + " (missing doc ID)");
              continue;
          }
          await deleteChat(item);
          deletedCount++;
          if (item.id === currentGlobalChatId) shouldNavigate = true;
        } catch (error) { errors.push(item.id); }
      }
      // ... (toast et navigation)
      if (errors.length === 0) toast.success(`${deletedCount} chat(s) deleted`);
      else toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteArg.length} chats. ${errors.length} failed.`);
      await loadEntries();
      setSelectedItems([]);
      setSelectionMode(false);
      if (shouldNavigate) window.location.pathname = '/';
    },
    [deleteChat, loadEntries],
  );

  const closeDialog = useCallback(() => setDialogContent(null), []);
  const toggleSelectionMode = useCallback(() => setSelectionMode(prev => { if (prev) setSelectedItems([]); return !prev; }), []);
  const toggleItemSelection = useCallback((id: string) => setSelectedItems(prev => prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]), []);

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) { toast.info('Select chats to delete'); return; }
    const chats = list.filter(item => selectedItems.includes(item.id));
    if (chats.length === 0) { toast.error('Selected chats not found'); return; }
    setDialogContent({ type: 'bulkDelete', items: chats });
  }, [selectedItems, list]);

  const selectAll = useCallback(() => {
    const ids = filteredList.map(item => item.id);
    setSelectedItems(prev => ids.length > 0 && ids.every(id => prev.includes(id)) ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  }, [filteredList]);

  useEffect(() => {
    if (open) {
      console.log("Menu.client: Menu opened, triggering loadEntries.");
      loadEntries();
    }
  }, [open, loadEntries]);

  useEffect(() => { /* ... mousemove effect ... */
    const enterThreshold = 40;
    const exitThreshold = 40;
    function onMouseMove(event: MouseEvent) {
      if (isSettingsOpen) return;
      if (event.pageX < enterThreshold) setOpen(true);
      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [isSettingsOpen]);

  const handleDuplicate = async (id: string) => { await duplicateCurrentChat(id); await loadEntries(); };
  const handleSettingsClick = () => setIsSettingsOpen(true);
  const handleSettingsClose = () => setIsSettingsOpen(false);

  // ... (JSX reste le même, y compris le loader)
  // Assurez-vous que HistoryItem et binDates fonctionnent avec la structure de ChatHistoryItem
  // et que filteredList est bien mise à jour par useSearchFilter.

  if (isAppwriteLoading && open) {
      return (
          <motion.div
            ref={menuRef}
            initial="closed"
            animate="open"
            variants={menuVariants}
            style={{ width: '340px' }}
            className="flex flex-col side-menu fixed top-0 h-full bg-white/50 dark:bg-gray-950/80 backdrop-blur-sm shadow-sm text-sm z-sidebar items-center justify-center"
          >
              <div className="i-ph-spinner-gap-bold animate-spin w-8 h-8 text-gray-700 dark:text-gray-300" />
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading chats...</p>
          </motion.div>
      );
  }

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex selection-accent flex-col side-menu fixed top-0 h-full',
          'bg-white/50 backdrop-blur-sm dark:bg-gray-950/80',
          'shadow-sm text-sm',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800/50 ">
          <div /> {/* Placeholder pour l'alignement */}
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {profile?.username || 'Guest User'}
            </span>
            <div className="flex items-center justify-center w-[32px] h-[32px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0">
              {profile?.avatar ? (
                <img src={profile.avatar} alt={profile?.username || 'User'} className="w-full h-full object-cover" loading="eager" decoding="sync"/>
              ) : (
                <div className="i-ph:user-fill text-lg" />
              )}
            </div>
          </div>
        </div>

        {/* Contenu principal du menu */}
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          {/* Section "Start new chat" et recherche */}
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <a href="/" className="flex w-full group items-center gap-x-2 rounded-lg bg-black dark:bg-purple-600 px-3 h-[40px] text-sm text-white dark:text-white justify-center shadow-xs outline-none transition hover:bg-black/90 dark:hover:bg-purple-700">
                <span className="i-ph:plus-circle-bold text-lg"/>
                <span className="text-sm">Start new chat</span>
              </a>
            </div>
            <div className="relative justify-start w-full flex items-center gap-2 pl-3 pr-3 py-2 rounded-lg focus-within:ring-1 focus-within:ring-purple-500/50 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-700">
              <SiSafari size={18} className="text-gray-400 dark:text-gray-500"/>
              <input className="w-full h-full outline-none bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400" type="text" placeholder="Search chats..." onChange={handleSearchChange} aria-label="Search chats"/>
            </div>
          </div>

          {/* Section "Your Chats" et boutons de sélection */}
          <div className="flex items-center justify-between text-sm px-4 py-2">
            <div className="font-medium text-gray-600 dark:text-gray-400">Your Chats</div>
            {selectionMode && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {filteredList.length > 0 && selectedItems.length === filteredList.length ? 'Deselect all' : 'Select all'}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDeleteClick} disabled={selectedItems.length === 0}>
                  Delete selected
                </Button>
              </div>
            )}
          </div>

          {/* Liste des chats */}
          <div className="flex-1 overflow-auto px-3 pb-3">
            {(filteredList.length === 0 && !isAppwriteLoading) && (
              <div className="px-4 text-gray-500 dark:text-gray-400 text-sm">
                {list.length === 0 ? 'No previous conversations' : 'No matches found'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm px-4 py-1">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        exportChat={exportChat}
                        onDelete={(event) => { event.preventDefault(); event.stopPropagation(); setDialogContent({ type: 'delete', item }); }}
                        onDuplicate={() => handleDuplicate(item.id)}
                        selectionMode={selectionMode}
                        isSelected={selectedItems.includes(item.id)}
                        onToggleSelection={toggleItemSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {dialogContent !== null && (
                <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                  {dialogContent.type === 'delete' && (
                    <>
                      <div className="p-6 bg-white dark:bg-gray-950">
                        <DialogTitle className="text-gray-900 dark:text-white">Delete Chat?</DialogTitle>
                        <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                          <p>You are about to delete <span className="font-medium text-gray-900 dark:text-white">{dialogContent.item.description}</span></p>
                          <p className="mt-2">Are you sure you want to delete this chat?</p>
                        </DialogDescription>
                      </div>
                      <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                        <DialogButton type="secondary" onClick={closeDialog}>Cancel</DialogButton>
                        <DialogButton type="danger" onClick={(event) => { deleteItem(event, dialogContent.item); closeDialog(); }}>Delete</DialogButton>
                      </div>
                    </>
                  )}
                  {dialogContent.type === 'bulkDelete' && (
                    <>
                      <div className="p-6 bg-white dark:bg-gray-950">
                        <DialogTitle className="text-gray-900 dark:text-white">Delete Selected Chats?</DialogTitle>
                        <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                          <p>You are about to delete {dialogContent.items.length} {dialogContent.items.length === 1 ? 'chat' : 'chats'}:</p>
                          <div className="mt-2 max-h-32 overflow-auto border border-gray-100 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900 p-2">
                            <ul className="list-disc pl-5 space-y-1">
                              {dialogContent.items.map((chatItem: ChatHistoryItem) => ( <li key={chatItem.id} className="text-sm"><span className="font-medium text-gray-900 dark:text-white">{chatItem.description}</span></li>))}
                            </ul>
                          </div>
                          <p className="mt-3">Are you sure you want to delete these chats?</p>
                        </DialogDescription>
                      </div>
                      <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                        <DialogButton type="secondary" onClick={closeDialog}>Cancel</DialogButton>
                        <DialogButton type="danger" onClick={() => { deleteSelectedItems(dialogContent.items); closeDialog(); }}>Delete</DialogButton>
                      </div>
                    </>
                  )}
                </Dialog>
              )}
            </DialogRoot>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3">
            <SettingsButton onClick={handleSettingsClick} />
            {/* <ThemeSwitch /> */}
          </div>
        </div>
      </motion.div>
      <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
