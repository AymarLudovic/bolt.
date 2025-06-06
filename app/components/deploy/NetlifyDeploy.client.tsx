import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path'; // Votre utilitaire de chemin
import { useState, useCallback } from 'react'; // Ajout de useCallback
import type { ActionCallbackData } from '~/lib/runtime/message-parser';

// CORRECTION ICI: Importer chatIdAtom au lieu de chatId
import { chatIdAtom } from '~/lib/persistence/useChatHistory';

// Définition des types pour la réponse de l'API Netlify (à affiner)
interface NetlifySiteInfo {
  id: string;
  name: string;
  // ... autres champs ...
}

interface NetlifyDeployInfo {
  id: string;
  site_id: string;
  // ... autres champs ...
}

interface NetlifyDeployStatus {
  id: string;
  site_id: string;
  state: 'uploading' | 'uploaded' | 'building' | 'ready' | 'error' | 'current'; // et autres états possibles
  ssl_url?: string; // ou default_domain.name, etc.
  url?: string; // URL de prévisualisation
  error_message?: string;
  // ... autres champs ...
}

interface NetlifyDeploySuccessResponse {
  deploy: NetlifyDeployInfo; // Informations sur le déploiement initié
  site: NetlifySiteInfo;    // Informations sur le site (nouveau ou existant)
}

interface NetlifyApiError {
  message: string;
  code?: number;
  // ... autres champs d'erreur ...
}

interface NetlifyDeployErrorResponse {
  error: string | NetlifyApiError;
}

type NetlifyDeployApiResponse = NetlifyDeploySuccessResponse | NetlifyDeployErrorResponse;


export function useNetlifyDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const netlifyConn = useStore(netlifyConnection);
  // CORRECTION ICI: Utiliser chatIdAtom
  const currentChatId = useStore(chatIdAtom);

  const handleNetlifyDeploy = useCallback(async () => {
    if (!netlifyConn.user || !netlifyConn.token) {
      toast.error('Please connect to Netlify first in the settings tab!');
      return false;
    }

    if (!currentChatId) {
      toast.error('No active chat ID found. Cannot associate deployment with a chat.');
      return false;
    }

    const mainArtifact = workbenchStore.firstArtifact;
    if (!mainArtifact) {
      toast.error('No active project artifact found to deploy.');
      return false;
    }

    setIsDeploying(true);
    const deploymentArtifactId = `deploy-netlify-${currentChatId}-${Date.now()}`;

    workbenchStore.addArtifact({
      id: deploymentArtifactId,
      messageId: deploymentArtifactId,
      title: 'Netlify Deployment',
      type: 'standalone',
    });

    const deployVisualArtifact = workbenchStore.artifacts.get()[deploymentArtifactId];
    if (!deployVisualArtifact) {
        console.error("Failed to retrieve the deployment visual artifact from the store.");
        toast.error("Internal error: Could not track deployment progress.");
        setIsDeploying(false);
        return false;
    }

    try {
      deployVisualArtifact.runner.handleDeployAction('building', 'running', { source: 'netlify' });

      const buildActionId = `build-netlify-${Date.now()}`;
      const buildActionData: ActionCallbackData = {
        messageId: mainArtifact.id,
        artifactId: mainArtifact.id,
        actionId: buildActionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      mainArtifact.runner.addAction(buildActionData);
      await mainArtifact.runner.runAction(buildActionData);

      if (!mainArtifact.runner.buildOutput?.path) {
        const errorMsg = 'Build failed or build output path not found. Check terminal for details.';
        deployVisualArtifact.runner.handleDeployAction('building', 'failed', { error: errorMsg, source: 'netlify' });
        throw new Error(errorMsg);
      }

      deployVisualArtifact.runner.handleDeployAction('deploying', 'running', { source: 'netlify' });

      const container = await webcontainer;
      const rawBuildPath = mainArtifact.runner.buildOutput.path;
      let normalizedBuildPath = rawBuildPath.startsWith('/home/project')
        ? rawBuildPath.substring('/home/project'.length)
        : rawBuildPath;
      if (!normalizedBuildPath.startsWith('/')) {
        normalizedBuildPath = '/' + normalizedBuildPath;
      }
      if (normalizedBuildPath === '/') { normalizedBuildPath = ''; }

      const commonOutputDirs = [normalizedBuildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'].filter(p => p && p !== '/');
      let finalBuildPath = '';
      let buildPathFound = false;

      for (const dir of commonOutputDirs) {
        try {
          const entries = await container.fs.readdir(dir);
          if (entries.length > 0 || dir === normalizedBuildPath) {
            finalBuildPath = dir;
            buildPathFound = true;
            console.log(`Using Netlify build directory: ${finalBuildPath}`);
            break;
          } else {
            console.log(`Netlify: Directory ${dir} exists but is empty, trying next option.`);
          }
        } catch (error) {
          console.log(`Netlify: Directory ${dir} does not exist or is not accessible, trying next option.`);
        }
      }

      if (!buildPathFound) {
        const errorMsg = 'Could not find a valid (non-empty) build output directory for Netlify. Checked: ' + commonOutputDirs.join(', ');
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'netlify' });
        throw new Error(errorMsg);
      }

      async function getAllProjectFiles(basePath: string, currentRelativePath: string = ''): Promise<Record<string, string>> {
        const filesMap: Record<string, string> = {};
        const absoluteCurrentPath = path.join(basePath, currentRelativePath);
        const entries = await container.fs.readdir(absoluteCurrentPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryName = entry.name;
          const relativeFilePath = path.join(currentRelativePath, entryName);
          const absoluteFilePath = path.join(absoluteCurrentPath, entryName);

          if (entry.isFile()) {
            const content = await container.fs.readFile(absoluteFilePath, 'utf-8');
            filesMap[relativeFilePath.startsWith('/') ? relativeFilePath.substring(1) : relativeFilePath] = content;
          } else if (entry.isDirectory()) {
            if (entryName === 'node_modules' || entryName === '.git') continue;
            const subFiles = await getAllProjectFiles(basePath, relativeFilePath);
            Object.assign(filesMap, subFiles);
          }
        }
        return filesMap;
      }

      const filesToDeploy = await getAllProjectFiles(finalBuildPath);

      if (Object.keys(filesToDeploy).length === 0) {
        const errorMsg = `Netlify: Build directory '${finalBuildPath}' is empty. Nothing to deploy.`;
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'netlify' });
        throw new Error(errorMsg);
      }

      const existingNetlifySiteId = localStorage.getItem(`netlify-site-${currentChatId}`);

      const apiResponse = await fetch('/api/netlify-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: existingNetlifySiteId || undefined,
          files: filesToDeploy,
          token: netlifyConn.token,
          chatId: currentChatId, // Pour nommer le site si nouveau
        }),
      });

      const responseData = await apiResponse.json() as NetlifyDeployApiResponse;

      if (!apiResponse.ok || ('error' in responseData)) {
        const errorDetail = ('error' in responseData) ? responseData.error : 'Unknown API error';
        const errorMessageText = typeof errorDetail === 'string' ? errorDetail : errorDetail.message;
        console.error('Netlify Deploy API Error:', responseData);
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMessageText, source: 'netlify' });
        throw new Error(errorMessageText);
      }
      
      const successData = responseData as NetlifyDeploySuccessResponse;
      if (!successData.deploy?.id || !successData.site?.id) {
          const errorMsg = "Netlify deployment API response missing crucial data (Deploy ID or Site ID).";
          deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'netlify' });
          throw new Error(errorMsg);
      }

      const deployId = successData.deploy.id;
      const siteId = successData.site.id;

      // Polling for deployment status
      const maxAttempts = 120; // Environ 2 minutes avec 1s de délai, ou plus avec 2s
      let attempts = 0;
      let deploymentStatus: NetlifyDeployStatus | null = null;

      deployVisualArtifact.runner.handleDeployAction('deploying', 'running', { source: 'netlify' });


      while (attempts < maxAttempts) {
        try {
          console.log(`Netlify: Checking status attempt ${attempts + 1}/${maxAttempts} for deploy ${deployId} on site ${siteId}`);
          const statusResponse = await fetch(
            `https://api.netlify.com/api/v1/deploys/${deployId}`, // L'API pour un déploiement spécifique
            {
              headers: { Authorization: `Bearer ${netlifyConn.token}` },
              cache: 'no-store', // Ne pas mettre en cache la réponse de statut
            },
          );

          if (!statusResponse.ok) {
            // Gérer les erreurs de l'API de statut elle-même
            const statusErrorData = await statusResponse.json().catch(()=>({}));
            const statusErrorMessage = (statusErrorData as NetlifyApiError)?.message || `Status check failed: ${statusResponse.status}`;
            console.error('Netlify status check API error:', statusErrorData);
            throw new Error(statusErrorMessage); // Relancer pour être attrapé par le catch externe du while
          }

          deploymentStatus = await statusResponse.json() as NetlifyDeployStatus;

          if (deploymentStatus.state === 'ready' || deploymentStatus.state === 'current') { // 'current' est aussi un état de succès pour le live deploy
            break;
          }
          if (deploymentStatus.state === 'error') {
            const errorMsg = 'Netlify deployment failed: ' + (deploymentStatus.error_message || 'Unknown error during Netlify build/deploy phase.');
            deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'netlify' });
            throw new Error(errorMsg);
          }

          // Mettre à jour l'artefact avec le statut en cours si nécessaire (optionnel)
          // deployVisualArtifact.runner.handleDeployAction('deploying', 'running', { message: `State: ${deploymentStatus.state}`, source: 'netlify' });

          attempts++;
          await new Promise((resolve) => setTimeout(resolve, attempts < 10 ? 2000 : 5000)); // Délai plus long après quelques tentatives
        } catch (error) {
          console.error('Netlify status check loop error:', error);
          // Si l'erreur est critique (par ex. 401 Unauthorized), on pourrait arrêter plus tôt
          // Pour l'instant, on continue le polling avec un délai
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Délai un peu plus long en cas d'erreur de check
        }
      }

      if (attempts >= maxAttempts || !deploymentStatus || (deploymentStatus.state !== 'ready' && deploymentStatus.state !== 'current')) {
        const errorMsg = deploymentStatus ? `Deployment ended in state: ${deploymentStatus.state}` : 'Deployment timed out or status unknown.';
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'netlify' });
        throw new Error(errorMsg);
      }

      localStorage.setItem(`netlify-site-${currentChatId}`, siteId);

      const finalUrl = deploymentStatus.ssl_url || deploymentStatus.url; // Prioriser ssl_url
      if (!finalUrl) {
        const errorMsg = "Netlify deployment succeeded but no final URL was found.";
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'netlify' });
        throw new Error(errorMsg);
      }


      deployVisualArtifact.runner.handleDeployAction('complete', 'complete', {
        url: finalUrl,
        // Si vous voulez ajouter projectId/Name pour Netlify, modifiez le type de handleDeployAction
        // projectId: siteId,
        // projectName: successData.site.name,
        source: 'netlify',
      });

      toast.success(`Project deployed to Netlify! URL: ${finalUrl}`);
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Netlify deployment failed due to an unknown error.';
      console.error('Netlify deploy process error:', err);
      toast.error(errorMessage);
      if (deployVisualArtifact) {
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMessage, source: 'netlify' });
      }
      return false;
    } finally {
      setIsDeploying(false);
    }
  }, [netlifyConn.token, netlifyConn.user, currentChatId, setIsDeploying]);

  return {
    isDeploying,
    handleNetlifyDeploy,
    isConnected: !!netlifyConn.user && !!netlifyConn.token,
  };
}
