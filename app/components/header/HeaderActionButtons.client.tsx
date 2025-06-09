import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { netlifyConnection, updateNetlifyConnection } from '~/lib/stores/netlify';
import { vercelConnection, updateVercelConnection } from '~/lib/stores/vercel';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { useEffect, useRef, useState, Fragment } from 'react';
import { streamingState } from '~/lib/stores/streaming';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { VercelDeploymentLink } from '~/components/chat/VercelDeploymentLink.client';
import { useVercelDeploy } from '~/components/deploy/VercelDeploy.client';
import { useNetlifyDeploy } from '~/components/deploy/NetlifyDeploy.client';
import { SiNetlify, SiVercel } from 'react-icons/si';
import { activeConnectionModalAtom, type ProviderType } from '~/lib/stores/connectionModals';
import { toast } from 'react-toastify';
import NetlifyConnection from '../@settings/tabs/connections/NetlifyConnection';
import VercelConnection from '../@settings/tabs/connections/VercelConnection';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const netlifyConn = useStore(netlifyConnection);
  const vercelConn = useStore(vercelConnection);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews.length > 0 ? previews[0] : null;
  const [isDeploying, setIsDeploying] = useState(false);
  const isSmallViewport = useViewport(1024);
  const canHideChat = showWorkbench || !showChat;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isStreaming = useStore(streamingState);
  const { handleVercelDeploy } = useVercelDeploy();
  const { handleNetlifyDeploy } = useNetlifyDeploy();

  const activeModal = useStore(activeConnectionModalAtom);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (activeModal && modalContainerRef.current && !modalContainerRef.current.contains(event.target as Node) && event.target !== dropdownRef.current && !dropdownRef.current?.contains(event.target as Node) ) {
        activeConnectionModalAtom.set(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeModal]);

  const onVercelDeployInternal = async () => {
    setIsDeploying(true);
    try {
      await handleVercelDeploy();
    } finally {
      setIsDeploying(false);
    }
  };

  const onNetlifyDeployInternal = async () => {
    setIsDeploying(true);
    try {
      await handleNetlifyDeploy();
    } finally {
      setIsDeploying(false);
    }
  };

  const openConnectComponent = (provider: ProviderType) => {
    activeConnectionModalAtom.set(provider);
    setIsDropdownOpen(false);
  };

  const disconnectFromNetlify = () => {
    localStorage.removeItem('netlify_connection');
    document.cookie = 'netlifyToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    updateNetlifyConnection({ user: null, token: '', stats: undefined });
    toast.info("Disconnected from Netlify.");
    setIsDropdownOpen(false);
  };

  const disconnectFromVercel = () => {
    updateVercelConnection({ user: null, token: '', stats: undefined });
    toast.info("Disconnected from Vercel.");
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex items-center">
      <div className="relative" ref={dropdownRef}>
        <div
          style={{border: "1px solid #4B5563"}}
          className={classNames(
            'w-[150px] h-[37px] justify-center flex bg-black text-[#E4E4E4] items-center gap-2 py-1 px-2 rounded-[25px]',
            isDeploying || !activePreview || isStreaming ? 'opacity-60 pointer-events-none' : 'opacity-100 cursor-pointer hover:bg-neutral-800'
          )}
          onClick={(!isDeploying && activePreview && !isStreaming) ? () => setIsDropdownOpen(!isDropdownOpen) : undefined}
        >
          <div className={classNames(
              'text-white w-full flex items-center justify-center text-sm',
               isDeploying || !activePreview || isStreaming ? 'opacity-80' : 'opacity-100'
            )}
          >
            {isDeploying ? `Deploying...` : 'Deploy'}
          </div>
        </div>

        {isDropdownOpen && (
          <div className="absolute right-0 flex flex-col gap-1 z-50 p-1 mt-2 min-w-[15.5rem] bg-white dark:bg-[#1F2023] rounded-[12px] border border-neutral-200 dark:border-neutral-700 shadow-lg">
            {/* Netlify */}
            {!netlifyConn.user ? (
              // Le bouton "Connect to Netlify" est maintenant masqué (commenté)
              /* 
              <button
                onClick={() => openConnectComponent('netlify')}
                disabled={isDeploying}
                className="flex items-center w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 gap-2.5 rounded-md transition-colors"
              >
                <SiNetlify size={22} className="text-[#00C7B7]" />
                <span className="flex-grow text-left">Connect to Netlify</span>
              </button>
              */
             null // Ou ne rien afficher ici si non connecté et que le bouton de connexion est masqué
            ) : (
              <Fragment>
                <button
                  onClick={() => {
                    onNetlifyDeployInternal();
                    setIsDropdownOpen(false);
                  }}
                  disabled={isDeploying || !activePreview}
                  className="flex items-center w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 gap-2.5 rounded-md group relative transition-colors"
                >
                  <SiNetlify size={22} className="text-[#00C7B7]" />
                  <span className="flex-grow text-left">Deploy to Netlify</span>
                  <NetlifyDeploymentLink />
                </button>
                <button
                  onClick={disconnectFromNetlify}
                  className="flex items-center justify-start w-full px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700/30 gap-1.5 rounded-md transition-colors"
                >
                  <div className="i-ph:power w-3.5 h-3.5"/> Disconnect Netlify
                </button>
              </Fragment>
            )}

            {/* Vercel */}
            {!vercelConn.user ? (
              <button
                onClick={() => openConnectComponent('vercel')}
                disabled={isDeploying}
                className="flex items-center w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 gap-2.5 rounded-md transition-colors"
              >
                <SiVercel size={18} className="text-black dark:text-white" />
                <span className="flex-grow text-left">Connect to Vercel</span>
              </button>
            ) : (
              <Fragment>
                <button
                  onClick={() => {
                    onVercelDeployInternal();
                    setIsDropdownOpen(false);
                  }}
                  disabled={isDeploying || !activePreview}
                  className="flex items-center w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 gap-2.5 rounded-md group relative transition-colors"
                >
                  <SiVercel size={18} className="text-black dark:text-white"/>
                  <span className="flex-grow text-left">Deploy to Vercel</span>
                  <VercelDeploymentLink />
                </button>
                 <button
                  onClick={disconnectFromVercel}
                  className="flex items-center justify-start w-full px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700/30 gap-1.5 rounded-md transition-colors"
                >
                  <div className="i-ph:power w-3.5 h-3.5"/> Disconnect Vercel
                </button>
              </Fragment>
            )}
          </div>
        )}
      </div>

      {activeModal && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[1000]"
          onClick={(e) => { if (e.target === e.currentTarget) { activeConnectionModalAtom.set(null); } }}
        >
          <div
            ref={modalContainerRef}
            className="bg-white dark:bg-neutral-900 p-5 pt-6 rounded-xl shadow-2xl w-full max-w-lg mx-auto relative transform transition-all duration-300 ease-out"
            style={{ transform: 'translateY(-20px)', opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
                onClick={() => { activeConnectionModalAtom.set(null); }}
                className="absolute top-3 right-3 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors z-10"
                aria-label="Close connection panel"
            >
                <div className="i-ph:x-bold w-5 h-5" />
            </button>

            {activeModal === 'netlify' && (
              <NetlifyConnection />
            )}
            {activeModal === 'vercel' && (
              <VercelConnection />
            )}
          </div>
        </div>
      )}

      <div className="flex border md:hidden not-md:flex border-bolt-elements-borderColor rounded-md overflow-hidden ml-2">
        <Button
          active={showChat}
          disabled={!canHideChat || isSmallViewport}
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
        </Button>
      </div>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
}

function Button({ active = false, disabled = false, children, onClick, className }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-neutral-900',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
            !active,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
            disabled,
        },
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
