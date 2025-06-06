import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { vercelConnection } from '~/lib/stores/vercel';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path'; // Votre utilitaire de chemin
import { useState, useCallback } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatIdAtom } from '~/lib/persistence/useChatHistory';

// Définition des types pour la réponse de l'API Vercel (à affiner selon la doc Vercel exacte)
interface VercelDeploymentInfo {
  id: string;
  url: string;
  // ... autres champs pertinents du déploiement ...
}

interface VercelProjectInfo {
  id: string;
  name: string;
  // ... autres champs pertinents du projet ...
}

interface VercelDeploySuccessResponse {
  deploy: VercelDeploymentInfo;
  project: VercelProjectInfo;
}

interface VercelApiErrorDetail {
  message: string;
  code?: string;
}

interface VercelDeployErrorResponse {
  error: string | VercelApiErrorDetail; // L'erreur peut être une chaîne ou un objet
}

type VercelDeployApiResponse = VercelDeploySuccessResponse | VercelDeployErrorResponse;

export function useVercelDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const vercelConn = useStore(vercelConnection);
  const currentChatId = useStore(chatIdAtom);

  const handleVercelDeploy = useCallback(async () => {
    if (!vercelConn.token || !vercelConn.user) {
      toast.error('Please connect to Vercel first in the settings tab!');
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
    const deploymentArtifactId = `deploy-vercel-${currentChatId}-${Date.now()}`;

    workbenchStore.addArtifact({
      id: deploymentArtifactId,
      messageId: deploymentArtifactId,
      title: 'Vercel Deployment',
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
      deployVisualArtifact.runner.handleDeployAction('building', 'running', { source: 'vercel' });

      const buildActionId = `build-vercel-${Date.now()}`;
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
        deployVisualArtifact.runner.handleDeployAction('building', 'failed', { error: errorMsg, source: 'vercel' });
        throw new Error(errorMsg);
      }

      deployVisualArtifact.runner.handleDeployAction('deploying', 'running', { source: 'vercel' });

      const container = await webcontainer;
      const rawBuildPath = mainArtifact.runner.buildOutput.path;
      let normalizedBuildPath = rawBuildPath.startsWith('/home/project')
        ? rawBuildPath.substring('/home/project'.length)
        : rawBuildPath;
      if (!normalizedBuildPath.startsWith('/')) {
        normalizedBuildPath = '/' + normalizedBuildPath;
      }
      if (normalizedBuildPath === '/') {
        normalizedBuildPath = '';
      }

      const commonOutputDirs = [normalizedBuildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'].filter(p => p && p !== '/');
      let finalBuildPath = '';
      let buildPathFound = false;

      for (const dir of commonOutputDirs) {
        try {
          const entries = await container.fs.readdir(dir);
          if (entries.length > 0 || dir === normalizedBuildPath) {
            finalBuildPath = dir;
            buildPathFound = true;
            console.log(`Using build directory: ${finalBuildPath}`);
            break;
          } else {
            console.log(`Directory ${dir} exists but is empty, trying next option.`);
          }
        } catch (error) {
          console.log(`Directory ${dir} does not exist or is not accessible, trying next option.`);
        }
      }

      if (!buildPathFound) {
        const errorMsg = 'Could not find a valid (non-empty) build output directory. Checked: ' + commonOutputDirs.join(', ');
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'vercel' });
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
        const errorMsg = `Build directory '${finalBuildPath}' is empty. Nothing to deploy.`;
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'vercel' });
        throw new Error(errorMsg);
      }

      const existingVercelProjectId = localStorage.getItem(`vercel-project-${currentChatId}`);

      const apiResponse = await fetch('/api/vercel-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: existingVercelProjectId || undefined,
          files: filesToDeploy,
          token: vercelConn.token,
          chatId: currentChatId,
        }),
      });

      const responseData = await apiResponse.json() as VercelDeployApiResponse;

      if (!apiResponse.ok || ('error' in responseData)) {
        const errorDetail = ('error' in responseData) ? responseData.error : 'Unknown API error';
        const errorMessageText = typeof errorDetail === 'string' ? errorDetail : errorDetail.message;
        console.error('Deploy API Error:', responseData);
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMessageText, source: 'vercel' });
        throw new Error(errorMessageText);
      }

      const successData = responseData as VercelDeploySuccessResponse;
      if (!successData.deploy?.url || !successData.project?.id) {
          const errorMsg = "Deployment API response missing crucial data (URL or Project ID).";
          deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMsg, source: 'vercel' });
          throw new Error(errorMsg);
      }

      localStorage.setItem(`vercel-project-${currentChatId}`, successData.project.id);

      // CORRECTION APPLIQUÉE ICI:
      // Ne pas passer projectId et projectName si le type de handleDeployAction ne les attend pas.
      deployVisualArtifact.runner.handleDeployAction('complete', 'complete', {
        url: successData.deploy.url,
        // projectId: successData.project.id, // Commenté ou supprimé
        // projectName: successData.project.name, // Commenté ou supprimé
        source: 'vercel',
      });

      toast.success(`Project deployed to Vercel! URL: ${successData.deploy.url}`);
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Vercel deployment failed due to an unknown error.';
      console.error('Vercel deploy process error:', err);
      toast.error(errorMessage);

      if (deployVisualArtifact) {
        deployVisualArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMessage, source: 'vercel' });
      }
      return false;
    } finally {
      setIsDeploying(false);
    }
  }, [vercelConn.token, vercelConn.user, currentChatId, setIsDeploying]);

  return {
    isDeploying,
    handleVercelDeploy,
    isConnected: !!vercelConn.user && !!vercelConn.token,
  };
}
