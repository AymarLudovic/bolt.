import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';
import {
  vercelConnection,
  isConnecting as vercelIsConnectingStoreGlobal, // Renommé pour clarté
  isFetchingStats as vercelIsFetchingStatsGlobal, // Renommé pour clarté
  updateVercelConnection,
  fetchVercelStats,
} from '~/lib/stores/vercel';
import { activeConnectionModalAtom, modalTokenInputAtom, triggerConnectAtom } from '~/lib/stores/connectionModals';

import { SiVercel } from 'react-icons/si';

export default function VercelConnection() {
  const connection = useStore(vercelConnection);
  const isConnectingGlobal = useStore(vercelIsConnectingStoreGlobal); // État global de connexion
  const isFetchingStatsGlobal = useStore(vercelIsFetchingStatsGlobal); // État global de fetch
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  // L'input token de CE composant est directement lié à connection.token dans le store Vercel

  const connectTrigger = useStore(triggerConnectAtom);
  const modalToken = useStore(modalTokenInputAtom);

  useEffect(() => {
    const fetchProjectsOnLoad = async () => {
      if (connection.user && connection.token) {
        await fetchVercelStats(connection.token);
      }
    };
    fetchProjectsOnLoad();
  }, [connection.user, connection.token]);

  useEffect(() => {
    if (connectTrigger === 'vercel' && modalToken) {
      console.log('VercelConnection: Auto-connecting with token from modal:', modalToken);
      // Mettre à jour le store Vercel avec le token du modal AVANT d'appeler la connexion
      updateVercelConnection({ ...connection, token: modalToken });
      handleConnectWithGivenToken(modalToken); // Appeler la logique de connexion
      triggerConnectAtom.set(null); // Réinitialiser le trigger
      activeConnectionModalAtom.set(null); // Fermer le modal
      modalTokenInputAtom.set(''); // Vider le token du modal
    }
  }, [connectTrigger, modalToken, connection]); // Ajouter connection comme dépendance

  const handleConnectWithGivenToken = async (apiToken: string | null) => { // Accepter null
    if (!apiToken) {
      toast.error('Vercel API token is required.');
      return;
    }
    vercelIsConnectingStoreGlobal.set(true);
    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Invalid token or unauthorized');
      const userData = (await response.json()) as any;
      updateVercelConnection({ user: userData.user || userData, token: apiToken, stats: connection.stats });
      await fetchVercelStats(apiToken);
      toast.success('Successfully connected to Vercel');
    } catch (error) {
      console.error('Auth error:', error);
      logStore.logError('Failed to authenticate with Vercel', { error });
      toast.error('Failed to connect to Vercel');
      // Ne pas réinitialiser le token ici si l'erreur vient du modal
      // Si c'est une connexion directe et qu'elle échoue, on peut vouloir garder le token dans l'input
      // updateVercelConnection({ user: null, token: apiToken }); // Ou garder l'ancien token
    } finally {
      vercelIsConnectingStoreGlobal.set(false);
    }
  };

  // Pour le bouton "Connect" DANS ce composant
  const handleLocalFormConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    await handleConnectWithGivenToken(connection.token); // Utilise le token du store (lié à l'input)
  };


  const handleDisconnect = () => {
    updateVercelConnection({ user: null, token: '', stats: undefined });
    setIsProjectsExpanded(false);
    toast.success('Disconnected from Vercel');
  };

  console.log('Vercel Connection State:', connection); // Votre console.log original

  return (
    <motion.div
      className="bg-white dark:bg-[#0A0A0A] rounded-lg  border-neutral-200 dark:border-neutral-700/50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiVercel size={22}></SiVercel>
            <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-100">Vercel Connection</h3>
          </div>
        </div>

        {!connection.user ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="vercel-token-input" className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Personal Access Token</label>
              <input
                id="vercel-token-input"
                type="password"
                value={connection.token || ''} // L'input est lié au token dans le store Vercel
                onChange={(e) => updateVercelConnection({ ...connection, user: null, token: e.target.value })} // Mise à jour du token dans le store
                disabled={isConnectingGlobal}
                placeholder="Enter your Vercel personal access token"
                className={classNames(
                  'w-full px-3 py-2 rounded-[12px] text-sm',
                  'bg-[#FAFAFA] dark:bg-neutral-800/50',
                  'border border-neutral-300 dark:border-neutral-700',
                  'text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
                  'disabled:opacity-60',
                )}
              />
              <div className="mt-2 text-xs underline text-neutral-500 dark:text-neutral-400">
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#888] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                   <div className="i-ph:globe w-3.5 h-3.5" />
                  Get your token
                 
                </a>
              </div>
            </div>

            <button
              onClick={handleLocalFormConnect}
              disabled={isConnectingGlobal || !connection.token}
              className={classNames(
                'px-4 py-2 rounded-[15px] text-sm flex items-center justify-center gap-2 w-full ', // w-full sur petit écran
                'bg-black text-white',
                'hover:bg-neutral-800 dark:hover:bg-neutral-700',
                'disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200',
                'transform active:scale-95',
              )}
            >
              {isConnectingGlobal ? (
                <>
                  <div className="i-ph:spinner-gap animate-spin w-4 h-4" />
                  Connecting...
                </>
              ) : (
                <>
                 
                  Connect
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDisconnect}
                  className={classNames(
                    'px-3 py-2 rounded-[15px] text-xs flex items-center gap-1.5', // Taille plus petite pour déconnexion
                    'bg-black text-white',
                    'hover:bg-red-700',
                    'transition-colors'
                  )}
                >
                 
                  Disconnect
                </button>
                <span className="text-sm text-neutral-600 dark:text-neutral-400 sr-only items-center gap-1">
                  <div className="i-ph:check-circle w-4 h-4 text-green-500" />
                  Connected to Vercel
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
              <img
                src={`https://vercel.com/api/www/avatar/${connection.user?.id || connection.user?.id || connection.user?.user?.uid || connection.user?.user?.id }`} // Essayer plusieurs champs pour l'avatar
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                alt="User Avatar"
                className="w-10 h-10 rounded-full border-2 border-blue-500"
              />
              <div>
                <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                  {connection.user?.name || connection.user?.username || connection.user?.user?.name || connection.user?.user?.username || 'Vercel User'}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {connection.user?.email || connection.user?.user?.email || 'No email available'}
                </p>
              </div>
            </div>

            {isFetchingStatsGlobal ? (
              <div className="sr-only items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                Fetching Vercel projects...
              </div>
            ) : (
              <div className='sr-only'>
                <button
                  onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                  className="w-full bg-transparent text-left text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2 flex items-center gap-1.5 py-1"
                >
                  <div className="i-ph:buildings w-4 h-4" />
                  Your Projects ({connection.stats?.totalProjects || 0})
                  <div
                    className={classNames(
                      'i-ph:caret-down w-4 h-4 ml-auto transition-transform',
                      isProjectsExpanded ? 'rotate-180' : '',
                    )}
                  />
                </button>
                {isProjectsExpanded && connection.stats?.projects?.length ? (
                  <div className="grid gap-3 max-h-60 overflow-y-auto pr-1"> {/* Ajout de scroll si beaucoup de projets */}
                    {connection.stats.projects.map((project) => (
                      <a
                        key={project.id}
                        href={`https://vercel.com/${connection.user?.username || connection.user?.user?.username}/${project.name}`} // Lien vers le dashboard du projet
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-md border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-neutral-800/30"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-sm font-medium text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                              <div className="i-ph:cube w-4 h-4 text-blue-500" />
                              {project.name}
                            </h5>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                              {project.targets?.production?.url ? (
                                <>
                                  <a
                                    href={`https://${project.targets.production.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {project.targets.production.url}
                                  </a>
                                  <span className="text-neutral-300 dark:text-neutral-600">•</span>
                                </>
                              ) : project.latestDeployments?.[0]?.url ? (
                                 <>
                                  <a
                                    href={`https://${project.latestDeployments[0].url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {project.latestDeployments[0].url}
                                  </a>
                                  <span className="text-neutral-300 dark:text-neutral-600">•</span>
                                </>
                              ) : null }
                              <span className="flex items-center gap-1">
                                <div className="i-ph:clock w-3 h-3" />
                               Bonjour
                              </span>
                            </div>
                          </div>
                          {project.framework && (
                            <div className="text-xs text-neutral-600 dark:text-neutral-300 px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700/50">
                              <span className="flex items-center gap-1">
                                {/* <div className="i-ph:code w-3 h-3" /> Icône Framework si vous en avez une */}
                                {project.framework}
                              </span>
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : isProjectsExpanded ? (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 p-2">
                    <div className="i-ph:info w-4 h-4" />
                    No projects found.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
