import { useEffect } from 'react';
import { useSupabaseConnection } from '~/lib/hooks/useSupabaseConnection';
import { classNames } from '~/utils/classNames'; // Correction: type ClassNamesArg supprimé
import { useStore } from '@nanostores/react';
import { chatIdAtom } from '~/lib/persistence/useChatHistory';
import { fetchSupabaseStats } from '~/lib/stores/supabase';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';
import { SiSupabase } from 'react-icons/si';

export function SupabaseConnection() {
  const {
    connection: supabaseConn,
    connecting,
    fetchingStats,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isDropdownOpen: isDialogOpen,
    setIsDropdownOpen: setIsDialogOpen,
    handleConnect,
    handleDisconnect,
    selectProject,
    handleCreateProject,
    updateToken,
    isConnected,
    fetchProjectApiKeys,
  } = useSupabaseConnection();

  const currentChatId = useStore(chatIdAtom);

  useEffect(() => {
    const handleOpenConnectionDialog = () => {
      setIsDialogOpen(true);
    };

    document.addEventListener('open-supabase-connection', handleOpenConnectionDialog);

    return () => {
      document.removeEventListener('open-supabase-connection', handleOpenConnectionDialog);
    };
  }, [setIsDialogOpen]);

  useEffect(() => {
    if (isConnected && currentChatId) {
      const savedProjectId = localStorage.getItem(`supabase-project-${currentChatId}`);
      if (!savedProjectId && supabaseConn.selectedProjectId) {
        localStorage.setItem(`supabase-project-${currentChatId}`, supabaseConn.selectedProjectId);
      } else if (savedProjectId && savedProjectId !== supabaseConn.selectedProjectId) {
        selectProject(savedProjectId);
      }
    }
  }, [isConnected, currentChatId, supabaseConn.selectedProjectId, selectProject]);

  useEffect(() => {
    if (currentChatId && supabaseConn.selectedProjectId) {
      localStorage.setItem(`supabase-project-${currentChatId}`, supabaseConn.selectedProjectId);
    } else if (currentChatId && !supabaseConn.selectedProjectId) {
      // localStorage.removeItem(`supabase-project-${currentChatId}`);
    }
  }, [currentChatId, supabaseConn.selectedProjectId]);

  useEffect(() => {
    if (isConnected && supabaseConn.token) {
      fetchSupabaseStats(supabaseConn.token).catch(console.error);
    }
  }, [isConnected, supabaseConn.token]);

  useEffect(() => {
    if (isConnected && supabaseConn.selectedProjectId && supabaseConn.token && !supabaseConn.credentials) {
      fetchProjectApiKeys(supabaseConn.selectedProjectId).catch(console.error);
    }
  }, [isConnected, supabaseConn.selectedProjectId, supabaseConn.token, supabaseConn.credentials, fetchProjectApiKeys]);

  return (
    <div className="relative">
      <div className="flex bg-[#FAFAFA] dark:bg-gray-800 border border-bolt-elements-borderColor dark:border-gray-700 rounded-[12px] overflow-hidden mr-2 text-sm">
        <CustomButton // Renommé pour éviter conflit si Button est importé d'une lib UI
          active
          disabled={connecting}
          onClick={() => setIsDialogOpen(!isDialogOpen)}
          className="hover:bg-bolt-elements-item-backgroundActive !text-black dark:!text-white flex items-center gap-1"
        >
            <div className="h-[25px] w-[25px] flex items-center justify-center p-1 rounded-full bg-black dark:bg-gray-700">
            <svg className='h-[16px] w-[16px]' viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0625L99.1935 40.0625C107.384 40.0625 111.952 49.5226 106.859 55.9372L63.7076 110.284Z" fill="url(#paint0_linear_supabase_conn)"/>
<path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0625L99.1935 40.0625C107.384 40.0625 111.952 49.5226 106.859 55.9372L63.7076 110.284Z" fill="url(#paint1_linear_supabase_conn)" fillOpacity="0.2"/>
<path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
<defs>
<linearGradient id="paint0_linear_supabase_conn" x1="53.9738" y1="54.9738" x2="94.1635" y2="71.8293" gradientUnits="userSpaceOnUse">
<stop stopColor="#249361"/>
<stop offset="1" stopColor="#3ECF8E"/>
</linearGradient>
<linearGradient id="paint1_linear_supabase_conn" x1="36.1558" y1="30.5779" x2="54.4844" y2="65.0804" gradientUnits="userSpaceOnUse">
<stop/>
<stop offset="1" stopOpacity="0"/>
</linearGradient>
</defs>
</svg>
            </div>
          {isConnected && supabaseConn.project && (
            <span className="ml-1 text-xs max-w-[100px] text-black dark:text-gray-200 truncate">{supabaseConn.project.name}</span>
          )}
        </CustomButton>
      </div>

      <DialogRoot open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {isDialogOpen && (
          <Dialog className="max-w-[520px] p-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {!isConnected ? (
              <div className="space-y-4">
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  <SiSupabase className="w-5 h-5 text-[#3ECF8E]" />
                  Connect to Supabase
                </DialogTitle>
                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary dark:text-gray-400 mb-2">Access Token</label>
                  <input
                    type="password"
                    value={supabaseConn.token ?? ''}
                    onChange={(e) => updateToken(e.target.value)}
                    disabled={connecting}
                    placeholder="Enter your Supabase access token"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                      'border border-[#E5E5E5] dark:border-[#333333]',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]',
                      'disabled:opacity-50',
                    )}
                  />
                  <div className="mt-2 text-sm text-bolt-elements-textSecondary dark:text-gray-400">
                    <a
                      href="https://app.supabase.com/account/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3ECF8E] hover:underline inline-flex items-center gap-1"
                    >
                      Get your token
                      <div className="i-ph:arrow-square-out w-4 h-4" />
                    </a>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    {/* Si DialogButtonProps n'accepte pas className, vous devez le retirer ou modifier DialogButtonProps */}
                    <DialogButton type="secondary">Cancel</DialogButton>
                  </DialogClose>
                  <button
                    onClick={handleConnect}
                    disabled={connecting || !supabaseConn.token}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                      'bg-[#3ECF8E] text-white',
                      'hover:bg-[#3BBF84]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {connecting ? (
                      <>
                        <div className="i-ph:spinner-gap animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <div className="i-ph:plug-charging w-4 h-4" />
                        Connect
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    <SiSupabase className="w-5 h-5 text-[#3ECF8E]" />
                    Supabase Connection
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-4 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
                  <div>
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-gray-100">{supabaseConn.user?.email}</h4>
                    <p className="text-xs text-bolt-elements-textSecondary dark:text-gray-400">Role: {supabaseConn.user?.role}</p>
                  </div>
                </div>
                {fetchingStats ? (
                  <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                    <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                    Fetching projects...
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                        className="bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2"
                      >
                        <div className="i-ph:database w-4 h-4" />
                        Your Projects ({supabaseConn.stats?.totalProjects || 0})
                        <div
                          className={classNames(
                            'i-ph:caret-down w-4 h-4 transition-transform',
                            isProjectsExpanded ? 'rotate-180' : '',
                          )}
                        />
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => supabaseConn.token && fetchSupabaseStats(supabaseConn.token)}
                          className="px-2 py-1 rounded-md text-xs bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#E5E5E5] dark:hover:bg-[#333333] flex items-center gap-1"
                          title="Refresh projects list"
                          disabled={!supabaseConn.token}
                        >
                          <div className="i-ph:arrows-clockwise w-3 h-3" />
                          Refresh
                        </button>
                        <button
                          onClick={() => handleCreateProject()}
                          className="px-2 py-1 rounded-md text-xs bg-[#3ECF8E] text-white hover:bg-[#3BBF84] flex items-center gap-1"
                        >
                          <div className="i-ph:plus w-3 h-3" />
                          New Project
                        </button>
                      </div>
                    </div>
                    {isProjectsExpanded && (
                      <>
                        {!supabaseConn.selectedProjectId && (
                          <div className="mb-2 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg text-sm text-bolt-elements-textSecondary">
                            Select a project or create a new one for this chat
                          </div>
                        )}
                        {supabaseConn.stats?.projects?.length ? (
                          <div className="grid gap-2 max-h-60 overflow-y-auto">
                            {supabaseConn.stats.projects.map((project) => (
                              <div
                                key={project.id}
                                className="block p-3 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#3ECF8E] dark:hover:border-[#3ECF8E] transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-1">
                                      <div className="i-ph:database w-3 h-3 text-[#3ECF8E]" />
                                      {project.name}
                                    </h5>
                                    <div className="text-xs text-bolt-elements-textSecondary mt-1">
                                      {project.region}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => selectProject(project.id)}
                                    className={classNames(
                                      'px-3 py-1 rounded-md text-xs',
                                      supabaseConn.selectedProjectId === project.id
                                        ? 'bg-[#3ECF8E] text-white'
                                        : 'bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#3ECF8E] hover:text-white',
                                    )}
                                  >
                                    {supabaseConn.selectedProjectId === project.id ? (
                                      <span className="flex items-center gap-1">
                                        <div className="i-ph:check w-3 h-3" />
                                        Selected
                                      </span>
                                    ) : (
                                      'Select'
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                            <div className="i-ph:info w-4 h-4" />
                            No projects found
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    {/* Si DialogButtonProps n'accepte pas className, vous devez le retirer ou modifier DialogButtonProps */}
                    <DialogButton type="secondary">Close</DialogButton>
                  </DialogClose>
                  {/* Si DialogButtonProps n'accepte pas className, vous devez le retirer ou modifier DialogButtonProps */}
                  <DialogButton type="danger" onClick={handleDisconnect}>
                    <div className="i-ph:plugs w-4 h-4" />
                    Disconnect
                  </DialogButton>
                </div>
              </div>
            )}
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}

interface CustomButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

function CustomButton({ active = false, disabled = false, children, onClick, className }: CustomButtonProps) {
  return (
    <button
      disabled={disabled}
      className={classNames(
        'flex items-center p-1.5',
        {
          'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentAccent dark:bg-gray-600 dark:text-green-400':
            active && !disabled,
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400 dark:hover:text-gray-200':
            !active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed opacity-50 dark:bg-gray-700 dark:text-gray-500':
            disabled,
        },
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
