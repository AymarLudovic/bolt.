import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks'; // Ce hook a aussi été modifié précédemment

// Ancien import:
// import { description as descriptionStore } from '~/lib/persistence';

// Nouvel import:
import { descriptionAtom as descriptionStore } from '~/lib/persistence/useChatHistory'; // Importer descriptionAtom et l'aliaser

import { Pen } from 'lucide-react';

export function ChatDescription() {
  // Utiliser useStore avec l'atome correctement importé
  const initialDescriptionFromStore = useStore(descriptionStore); // Ne pas utiliser '!' ici, gérer le cas undefined

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      // Passer la valeur de l'atome, ou une chaîne vide si undefined au début
      initialDescription: initialDescriptionFromStore ?? '',
      syncWithGlobalStore: true, // Assurez-vous que useEditChatDescription met à jour descriptionAtom
    });

  // Gérer le cas où la description n'est pas encore définie (ou est vide après le ?? '')
  // Le comportement "ne pas montrer le bouton éditer" est déjà géré par useEditChatDescription
  // qui utilise `initialDescription` pour son état.
  // Cependant, si vous voulez un rendu null explicite ici basé sur l'état initial du store:
  if (initialDescriptionFromStore === undefined || initialDescriptionFromStore === null) {
    // Ou si initialDescriptionFromStore est une chaîne vide et que vous ne voulez rien afficher
    // if (!initialDescriptionFromStore?.trim()) {
    return null; // Ou un spinner de chargement, ou un placeholder
  }


  return (
    <div className="flex items-center justify-center">
      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-center justify-center">
          <input
            type="text"
            className="bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary rounded px-2 mr-2 w-fit dark:bg-gray-700 dark:text-gray-100" // Ajout de styles dark mode
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur} // handleBlur est maintenant async
            onKeyDown={handleKeyDown} // handleKeyDown est maintenant async
            style={{ width: `${Math.max(currentDescription.length * 8, 100)}px` }}
          />
          <TooltipProvider>
            <WithTooltip tooltip="Save title">
              <div className="flex justify-between items-center p-2 rounded-md ">
                <button
                  type="submit" // Le type submit est bon ici
                  className="i-ph:check-bold scale-110 hover:text-bolt-elements-item-contentAccent dark:hover:text-green-400" // Style dark mode
                  // onMouseDown n'est généralement pas nécessaire si type="submit" est sur le bouton et qu'on a onSubmit sur le form
                  // Mais si vous avez une raison spécifique de le garder :
                  onMouseDown={(e) => { e.preventDefault(); handleSubmit(e as any); }} // S'assurer que handleSubmit est appelé correctement
                />
              </div>
            </WithTooltip>
          </TooltipProvider>
        </form>
      ) : (
        <>
          {/* Afficher currentDescription qui est géré par useEditChatDescription */}
          {/* Si currentDescription est vide après l'édition, que voulez-vous afficher ? */}
          {/* Peut-être revenir à initialDescriptionFromStore ou un placeholder ? */}
          {currentDescription || initialDescriptionFromStore || "Chat Title"} {/* Placeholder si tout est vide */}
          <TooltipProvider>
            <WithTooltip tooltip="Rename chat">
              <div className="flex justify-between items-center p-2 rounded-md ml-2">
              <button
                onClick={(event) => {
                    event.preventDefault();
                    toggleEditMode();
                }}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100" // Styles dark mode
              >
                <Pen size={18}></Pen>
              </button>
              </div>
            </WithTooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}
