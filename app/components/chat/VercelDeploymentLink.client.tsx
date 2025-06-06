import { useStore } from '@nanostores/react';
import { vercelConnection } from '~/lib/stores/vercel';
// CORRECTION ICI: Importer chatIdAtom au lieu de chatId
import { chatIdAtom } from '~/lib/persistence/useChatHistory';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';

export function VercelDeploymentLink() {
  const connection = useStore(vercelConnection);
  // CORRECTION ICI: Utiliser chatIdAtom
  const currentChatId = useStore(chatIdAtom);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchProjectData() {
      if (!connection.token || !currentChatId) {
        setDeploymentUrl(null); // Réinitialiser si pas de token ou d'ID de chat
        return;
      }

      // Check if we have a stored project ID for this chat
      const projectIdFromLocalStorage = localStorage.getItem(`vercel-project-${currentChatId}`);

      if (!projectIdFromLocalStorage) {
        setDeploymentUrl(null); // Réinitialiser si pas d'ID de projet stocké
        return;
      }

      setIsLoading(true);
      setDeploymentUrl(null); // Réinitialiser l'URL pendant le chargement

      try {
        // Fetch projects directly from the API
        const projectsResponse = await fetch('https://api.vercel.com/v9/projects?limit=100', { // Augmenter la limite si nécessaire
          headers: {
            Authorization: `Bearer ${connection.token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (!projectsResponse.ok) {
          const errorData = await projectsResponse.json().catch(() => ({}));
          console.error('Failed to fetch projects:', projectsResponse.status, errorData);
          throw new Error(`Failed to fetch projects: ${projectsResponse.status}, ${errorData}`);
        }

        const projectsData = (await projectsResponse.json()) as { projects?: { id: string, name: string, targets?: any }[] }; // Typage plus précis
        const projects = projectsData.projects || [];

        // Extract the chat number from currentChatId (assumant que currentChatId est une chaîne)
        const chatNumber = typeof currentChatId === 'string' ? currentChatId.split('-')[0] : '';

        // Find project by matching the chat number in the name
        // Et s'assurer que l'ID du projet correspond à celui stocké pour ce chat
        const project = projects.find((p: { id: string, name: string }) =>
            p.id === projectIdFromLocalStorage && p.name.includes(`bolt-diy-${chatNumber}`)
        );


        if (project && project.targets?.production?.alias && project.targets.production.alias.length > 0) {
            const aliases: string[] = project.targets.production.alias;
            const cleanUrl = aliases.find(
              (a) => a.endsWith('.vercel.app') && !a.includes('-projects.vercel.app') && !a.startsWith('www.')
            );
            const finalUrl = cleanUrl || aliases[0]; // Prendre le premier alias si aucun "clean" n'est trouvé
            if (finalUrl) {
                 setDeploymentUrl(`https://${finalUrl}`);
                 setIsLoading(false);
                 return;
            }
        }

        // Si les alias ne sont pas trouvés via la liste des projets, ou si le projet n'a pas été trouvé par nom/ID
        // essayer de récupérer les déploiements pour le projectIdFromLocalStorage
        if (projectIdFromLocalStorage) {
            const deploymentsResponse = await fetch(
                `https://api.vercel.com/v6/deployments?projectId=${projectIdFromLocalStorage}&limit=1&state=READY&target=production`, // Cibler les déploiements de production prêts
                {
                  headers: {
                    Authorization: `Bearer ${connection.token}`,
                    'Content-Type': 'application/json',
                  },
                  cache: 'no-store',
                },
              );

              if (deploymentsResponse.ok) {
                const deploymentsData = (await deploymentsResponse.json()) as { deployments?: { url: string }[] };
                if (deploymentsData.deployments && deploymentsData.deployments.length > 0) {
                  setDeploymentUrl(`https://${deploymentsData.deployments[0].url}`);
                  setIsLoading(false);
                  return;
                }
              } else {
                  console.warn(`Failed to fetch deployments for projectId ${projectIdFromLocalStorage}: ${deploymentsResponse.status}`);
              }
        }


        // Fallback (votre API personnalisée) - Peut-être moins nécessaire avec la logique ci-dessus
        // Mais gardé pour l'instant
        if (projectIdFromLocalStorage) {
            console.log("Attempting fallback API call for Vercel deployment URL");
            const fallbackResponse = await fetch(`/api/vercel-deploy?projectId=${projectIdFromLocalStorage}&token=${connection.token}`, {
              method: 'GET',
            });

            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                if ((data as { deploy?: { url?: string } }).deploy?.url) {
                  setDeploymentUrl((data as { deploy: { url: string } }).deploy.url);
                } else if ((data as { project?: { url?: string } }).project?.url) {
                  setDeploymentUrl((data as { project: { url: string } }).project.url);
                } else {
                  console.warn("Fallback API did not return a deployment URL.");
                }
            } else {
                 console.warn(`Fallback API /api/vercel-deploy failed: ${fallbackResponse.status}`);
            }
        }

      } catch (err) {
        console.error('Error fetching Vercel deployment data:', err);
        setDeploymentUrl(null); // S'assurer que l'URL est nulle en cas d'erreur
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjectData();
  }, [connection.token, currentChatId]); // Dépendances du useEffect

  if (isLoading) { // Afficher un indicateur de chargement si pertinent
    return (
        <div className="inline-flex items-center justify-center w-8 h-8">
            <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4 text-bolt-elements-textSecondary" />
        </div>
    );
  }

  if (!deploymentUrl) {
    return null;
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-[#000000] dark:hover:text-white z-50" // Ajout de dark mode
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className={`i-ph:link w-4 h-4 hover:text-blue-400`} />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary text-xs z-50 shadow-lg"
            sideOffset={5}
          >
            {deploymentUrl}
            <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
