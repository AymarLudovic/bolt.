// DataTab.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { ConfirmationDialog, SelectionDialog } from '~/components/ui/Dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '~/components/ui/Card';
import { motion } from 'framer-motion';
import { useDataOperations } from '~/lib/hooks/useDataOperations';
// import { openDatabase } from '~/lib/persistence/db'; // SUPPRIMER CET IMPORT
import { getAllChats, type Chat } from '~/lib/persistence/chats'; // Version Appwrite
import { DataVisualization } from './DataVisualization';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { databases as appwriteDatabases, getAppwriteSession } from '~/lib/appwrite'; // Importer l'instance Appwrite

// Le hook useBoltHistoryDB est supprimé.
// On va utiliser l'état global d'Appwrite.

interface ExtendedChat extends Chat {
  title?: string;
  updatedAt?: number; // Conserver si vous aviez une logique pour ça, sinon à revoir
}

function createChatItem(chat: Chat): ChatItem { // `chat` vient de la version Appwrite
  return {
    id: chat.id, // C'est le chatId métier
    label: (chat as ExtendedChat).title || chat.description || `Chat ${chat.id.slice(0, 8)}`,
    description: `${chat.messages.length} messages - Last updated: ${new Date(Date.parse(chat.timestamp)).toLocaleString()}`,
  };
}

interface SettingsCategory {
  id: string;
  label: string;
  description: string;
}

interface ChatItem {
  id: string;
  label: string;
  description: string;
}

export function DataTab() {
  const [isAppwriteReady, setIsAppwriteReady] = useState(false);
  const [appwriteError, setAppwriteError] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(true); // Pour le chargement initial des chats

  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyFileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const [showResetInlineConfirm, setShowResetInlineConfirm] = useState(false);
  const [showDeleteInlineConfirm, setShowDeleteInlineConfirm] = useState(false);
  const [showSettingsSelection, setShowSettingsSelection] = useState(false);
  const [showChatsSelection, setShowChatsSelection] = useState(false);

  const [settingsCategories] = useState<SettingsCategory[]>([
    // ... (vos catégories restent les mêmes)
    { id: 'core', label: 'Core Settings', description: 'User profile and main settings' },
    { id: 'providers', label: 'Providers', description: 'API keys and provider configurations' },
    { id: 'features', label: 'Features', description: 'Feature flags and settings' },
    { id: 'ui', label: 'UI', description: 'UI configuration and preferences' },
    { id: 'connections', label: 'Connections', description: 'External service connections' },
    { id: 'debug', label: 'Debug', description: 'Debug settings and logs' },
    { id: 'updates', label: 'Updates', description: 'Update settings and notifications' },
  ]);

  const [availableChats, setAvailableChats] = useState<ExtendedChat[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);

  // Adapter useDataOperations
  // Il ne prendra plus `customDb`. Il devra utiliser les fonctions globales d'Appwrite.
  // Vous devrez modifier useDataOperations en conséquence.
  const {
    isExporting,
    isImporting,
    isResetting,
    isDownloadingTemplate,
    handleExportSettings,
    handleExportSelectedSettings,
    handleExportAllChats,
    handleExportSelectedChats,
    handleImportSettings,
    handleImportChats,
    handleResetSettings,
    // handleResetChats, // Renommé ci-dessous pour inclure la gestion d'état locale
    handleDownloadTemplate,
    handleImportAPIKeys,
  } = useDataOperations({
    // customDb: undefined, // Plus besoin de passer la DB ici
    onReloadSettings: () => window.location.reload(),
    onReloadChats: async () => { // Devient async
      if (isAppwriteReady) {
        try {
          const chats = await getAllChats(); // Version Appwrite
          const extendedChats = chats as ExtendedChat[];
          setAvailableChats(extendedChats);
          setChatItems(extendedChats.map(createChatItem));
        } catch (error) {
           console.error('Error reloading chats after reset:', error);
           toast.error('Failed to reload chats: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    },
    onResetSettings: () => setShowResetInlineConfirm(false),
    onResetChats: () => setShowDeleteInlineConfirm(false), // Ceci sera appelé par handleResetChatsWithState
  });

  const { handleResetChats: originalHandleResetChats } = useDataOperations({});


  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportingKeys, setIsImportingKeys] = useState(false);


  // Initialisation et chargement des chats
  useEffect(() => {
    async function initializeAppwriteAndLoadData() {
      setDbLoading(true);
      if (appwriteDatabases) { // Vérifie si le SDK Appwrite est configuré
        try {
          await getAppwriteSession(); // S'assure qu'une session (anonyme ou autre) existe
          setIsAppwriteReady(true);
          console.log('Appwrite ready, loading chats...');
          const chats = await getAllChats(); // Version Appwrite
          console.log('Found chats:', chats.length);
          const extendedChats = chats as ExtendedChat[];
          setAvailableChats(extendedChats);
          setChatItems(extendedChats.map(createChatItem));
        } catch (error) {
          console.error('Error initializing Appwrite session or loading chats:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown Appwrite error';
          setAppwriteError(errorMessage);
          toast.error('Failed to connect to data service: ' + errorMessage);
        }
      } else {
        const noConfigMsg = 'Appwrite is not configured. Data operations will be unavailable.';
        console.warn(noConfigMsg);
        setAppwriteError(noConfigMsg);
        // toast.error(noConfigMsg); // Peut-être trop intrusif
      }
      setDbLoading(false);
    }
    initializeAppwriteAndLoadData();
  }, []); // Exécuter une seule fois


  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && isAppwriteReady) handleImportSettings(file);
      else if (!isAppwriteReady) toast.error("Data service not ready.");
    },
    [handleImportSettings, isAppwriteReady],
  );

  const handleAPIKeyFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && isAppwriteReady) {
        setIsImportingKeys(true);
        handleImportAPIKeys(file).finally(() => setIsImportingKeys(false));
      } else if (!isAppwriteReady) toast.error("Data service not ready.");
    },
    [handleImportAPIKeys, isAppwriteReady],
  );

  const handleChatFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && isAppwriteReady) handleImportChats(file);
      else if (!isAppwriteReady) toast.error("Data service not ready.");
    },
    [handleImportChats, isAppwriteReady],
  );

  const handleResetChatsWithState = useCallback(async () => {
    if (!isAppwriteReady) {
        toast.error("Data service not ready.");
        return;
    }
    setIsDeleting(true);
    try {
        // `originalHandleResetChats` vient de `useDataOperations`
        // et devrait maintenant appeler `deleteAllChats` (version Appwrite)
        await originalHandleResetChats();
        // Le `onReloadChats` de `useDataOperations` devrait être appelé par `originalHandleResetChats`
    } catch (error) {
        console.error("Error resetting chats:", error);
        toast.error("Failed to reset chats: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
        setIsDeleting(false);
        setShowDeleteInlineConfirm(false); // S'assurer que la modale se ferme
    }
  }, [originalHandleResetChats, isAppwriteReady]);


  if (appwriteError && !dbLoading) { // Si erreur de config Appwrite et pas en train de charger
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="i-ph-warning-octagon-bold w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Data Service Error</h2>
            <p className="text-muted-foreground mb-4">{appwriteError}</p>
            <p className="text-sm text-gray-500">
                Please check your Appwrite configuration or network connection.
            </p>
        </div>
    );
  }


  return (
    <div className="space-y-12">
      {/* ... (inputs cachés et dialogues de confirmation restent globalement les mêmes) ... */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileInputChange} className="hidden" />
      <input
        ref={apiKeyFileInputRef}
        type="file"
        accept=".json"
        onChange={handleAPIKeyFileInputChange}
        className="hidden"
      />
      <input
        ref={chatFileInputRef}
        type="file"
        accept=".json"
        onChange={handleChatFileInputChange}
        className="hidden"
      />

      <ConfirmationDialog
        isOpen={showResetInlineConfirm}
        onClose={() => setShowResetInlineConfirm(false)}
        title="Reset All Settings?"
        description="This will reset all your settings to their default values. This action cannot be undone."
        confirmLabel="Reset Settings"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isResetting}
        onConfirm={isAppwriteReady ? handleResetSettings : () => toast.error("Data service not ready.")}
      />

      <ConfirmationDialog
        isOpen={showDeleteInlineConfirm}
        onClose={() => setShowDeleteInlineConfirm(false)}
        title="Delete All Chats?"
        description="This will permanently delete all your chat history. This action cannot be undone."
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleResetChatsWithState}
      />

      <SelectionDialog
        isOpen={showSettingsSelection}
        onClose={() => setShowSettingsSelection(false)}
        title="Select Settings to Export"
        items={settingsCategories}
        onConfirm={(selectedIds) => {
          if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
          handleExportSelectedSettings(selectedIds);
          setShowSettingsSelection(false);
        }}
        confirmLabel="Export Selected"
      />

      <SelectionDialog
        isOpen={showChatsSelection}
        onClose={() => setShowChatsSelection(false)}
        title="Select Chats to Export"
        items={chatItems}
        onConfirm={(selectedIds) => {
          if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
          handleExportSelectedChats(selectedIds);
          setShowChatsSelection(false);
        }}
        confirmLabel="Export Selected"
      />

      {/* Chats Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-bolt-elements-textPrimary">Chats</h2>
        {dbLoading ? ( // Conserver dbLoading pour l'affichage initial
          <div className="flex items-center justify-center p-4">
            <div className="i-ph-spinner-gap-bold animate-spin w-6 h-6 mr-2" />
            <span>Loading chats data...</span>
          </div>
        ) : !isAppwriteReady && !appwriteError ? ( // Cas où Appwrite n'est pas prêt mais pas encore d'erreur explicite
             <div className="flex items-center justify-center p-4">
                <div className="i-ph-spinner-gap-bold animate-spin w-6 h-6 mr-2" />
                <span>Initializing data service...</span>
            </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-download-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-bolt-elements-item-contentAccent transition-colors">
                    Export All Chats
                  </CardTitle>
                </div>
                <CardDescription>Export all your chats to a JSON file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={async () => {
                      if (!isAppwriteReady) {
                        toast.error('Data service not available');
                        return;
                      }
                      if (availableChats.length === 0) {
                        toast.warning('No chats available to export');
                        return;
                      }
                      try {
                        await handleExportAllChats();
                      } catch (error) {
                        console.error('Error exporting chats:', error);
                        toast.error(
                          `Failed to export chats: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        );
                      }
                    }}
                    disabled={!isAppwriteReady || isExporting || availableChats.length === 0}
                    variant="outline"
                    // ... (classes et contenu du bouton restent similaires)
                     size="sm"
                    className={classNames(
                      'hover:text-bolt-elements-item-contentAccent hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent transition-colors w-full justify-center',
                      !isAppwriteReady || isExporting || availableChats.length === 0 ? 'cursor-not-allowed' : '',
                    )}
                  >
                    {isExporting ? (
                      <>
                        <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                        Exporting...
                      </>
                    ) : availableChats.length === 0 ? (
                      'No Chats to Export'
                    ) : (
                      'Export All'
                    )}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>
            {/* ... Autres cartes (Export Selected, Import, Delete All) à adapter de manière similaire ... */}
             <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph:list-checks w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg group-hover:text-bolt-elements-item-contentAccent transition-colors">
                    Export Selected Chats
                  </CardTitle>
                </div>
                <CardDescription>Choose specific chats to export.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => {
                        if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
                        setShowChatsSelection(true);
                    }}
                    disabled={!isAppwriteReady || isExporting || chatItems.length === 0}
                    variant="outline"
                    size="sm"
                    className={classNames( /* ... */ )}
                  >
                    {isExporting ? "Exporting..." : 'Select Chats'}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                 <div className="flex items-center mb-2">
                  <motion.div className="text-accent-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-upload-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg">Import Chats</CardTitle>
                </div>
                <CardDescription>Import chats from a JSON file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => {
                        if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
                        chatFileInputRef.current?.click();
                    }}
                    disabled={!isAppwriteReady || isImporting}
                    variant="outline"
                    size="sm"
                     className={classNames( /* ... */ )}
                  >
                    {isImporting ? "Importing..." : 'Import Chats'}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <motion.div className="text-red-500 mr-2" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <div className="i-ph-trash-duotone w-5 h-5" />
                  </motion.div>
                  <CardTitle className="text-lg">Delete All Chats</CardTitle>
                </div>
                <CardDescription>Delete all your chat history.</CardDescription>
              </CardHeader>
              <CardFooter>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full">
                  <Button
                    onClick={() => {
                        if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
                        setShowDeleteInlineConfirm(true);
                    }}
                    disabled={!isAppwriteReady || isDeleting || chatItems.length === 0}
                    variant="outline"
                    size="sm"
                    className={classNames( /* ... */ )}
                  >
                    {isDeleting ? "Deleting..." : 'Delete All'}
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      {/* Settings Section - à adapter de la même manière pour les conditions isAppwriteReady */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Exemple pour Export All Settings */}
            <Card>
                <CardHeader>
                    {/* ... */}
                    <CardTitle className="text-lg">Export All Settings</CardTitle>
                    <CardDescription>Export all your settings to a JSON file.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button
                        onClick={() => {
                            if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
                            handleExportSettings();
                        }}
                        disabled={!isAppwriteReady || isExporting}
                        variant="outline"
                        size="sm"
                        className={classNames( /* ... */ )}
                    >
                        {isExporting ? "Exporting..." : 'Export All'}
                    </Button>
                </CardFooter>
            </Card>
            {/* Adapter les autres cartes Settings de la même manière */}
        </div>
      </div>


      {/* API Keys Section - à adapter */}
       <div>
        <h2 className="text-xl font-semibold mb-4">API Keys</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
                <CardHeader>
                    {/* ... */}
                    <CardTitle className="text-lg">Download Template</CardTitle>
                    <CardDescription>Download a template file for your API keys.</CardDescription>
                </CardHeader>
                <CardFooter>
                     <Button
                        onClick={() => {
                            if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
                            handleDownloadTemplate();
                        }}
                        disabled={!isAppwriteReady || isDownloadingTemplate}
                        variant="outline"
                        size="sm"
                        className={classNames( /* ... */ )}
                    >
                        {isDownloadingTemplate ? "Downloading..." : 'Download'}
                    </Button>
                </CardFooter>
            </Card>
             <Card>
                <CardHeader>
                    {/* ... */}
                    <CardTitle className="text-lg">Import API Keys</CardTitle>
                    <CardDescription>Import API keys from a JSON file.</CardDescription>
                </CardHeader>
                <CardFooter>
                     <Button
                        onClick={() => {
                            if (!isAppwriteReady) { toast.error("Data service not ready."); return; }
                            apiKeyFileInputRef.current?.click();
                        }}
                        disabled={!isAppwriteReady || isImportingKeys}
                        variant="outline"
                        size="sm"
                        className={classNames( /* ... */ )}
                    >
                        {isImportingKeys ? "Importing..." : 'Import Keys'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>

      {/* Data Visualization */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Data Usage</h2>
        <Card>
          <CardContent className="p-5">
            {/* DataVisualization pourrait avoir besoin d'être adaptée si elle attendait `db` */}
            {isAppwriteReady ? (
                <DataVisualization chats={availableChats} />
            ) : (
                <p className="text-center text-muted-foreground">Data visualization unavailable.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
