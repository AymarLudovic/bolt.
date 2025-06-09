import { AnimatePresence, motion } from 'framer-motion';
import type { SupabaseAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';
import { supabaseConnection } from '~/lib/stores/supabase';
import { useStore } from '@nanostores/react';
import { useState } from 'react';

interface Props {
  alert: SupabaseAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

export function SupabaseChatAlert({ alert, clearAlert, postMessage }: Props) {
  const { content } = alert;
  const connection = useStore(supabaseConnection);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Determine connection state
  const isConnected = !!(connection.token && connection.selectedProjectId);

  // Set title and description based on connection state
  const title = isConnected ? 'Supabase Query' : 'Supabase Connection Required';
  const description = isConnected ? 'Execute database query' : 'Supabase connection required';
  const message = isConnected
    ? 'Please review the proposed changes and apply them to your database.'
    : 'Please connect to Supabase to continue with this operation.';

  const handleConnectClick = () => {
    // Dispatch an event to open the Supabase connection dialog
    document.dispatchEvent(new CustomEvent('open-supabase-connection'));
  };

  // Determine if we should show the Connect button or Apply Changes button
  const showConnectButton = !isConnected;

  const executeSupabaseAction = async (sql: string) => {
    if (!connection.token || !connection.selectedProjectId) {
      console.error('No Supabase token or project selected');
      return;
    }

    setIsExecuting(true);

    try {
      const response = await fetch('/api/supabase/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.token}`,
        },
        body: JSON.stringify({
          projectId: connection.selectedProjectId,
          query: sql,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(`Supabase query failed: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('Supabase query executed successfully:', result);
      clearAlert();
    } catch (error) {
      console.error('Failed to execute Supabase action:', error);
      postMessage(
        `*Error executing Supabase query please fix and return the query again*\n\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\`\n`,
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const cleanSqlContent = (content: string) => {
    if (!content) {
      return '';
    }

    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');

    cleaned = cleaned.replace(/(--).*$/gm, '').replace(/(#).*$/gm, '');

    const statements = cleaned
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)
      .join(';\n\n');

    return statements;
  };

  return (
    <AnimatePresence >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        style={{fontFamily: "Funnel Display"}}
        className="max-w-chat rounded-lg border-l-2 border border-bolt-elements-borderColor bg-white"
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2">
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
            <h3 className="text-sm font-medium ">{title}</h3>
          </div>
        </div>

        {/* SQL Content */}
        <div className="px-4">
          {!isConnected ? (
            <div className="p-3 rounded-md bg-[#fafafa]">
              <span className="text-sm text-bolt-elements-textPrimary">
                You must first connect to Supabase and select a project.
              </span>
            </div>
          ) : (
            <>
              <div
                className="flex items-center p-2 rounded-[12px] bg-[#FFF] border border-[#EEE] cursor-pointer"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                <div className="i-ph:database text-bolt-elements-textPrimary mr-2"></div>
                <span className="text-sm text-bolt-elements-textPrimary flex-grow">
                  {description || 'Create table and setup auth'}
                </span>
                <div
                  className={`i-ph:caret-up text-bolt-elements-textPrimary transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                ></div>
              </div>

              {!isCollapsed && content && (
                <div className="mt-2 p-3 bg-white border border-[#EEE] rounded-[12px] overflow-auto max-h-60 font-mono text-xs">
                  
                  <pre>{cleanSqlContent(content)}</pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Message and Actions */}
        <div className="p-4">
          <p className="text-sm text-bolt-elements-textSecondary mb-4">{message}</p>

          <div className="flex gap-2">
            {showConnectButton ? (
              <button
                onClick={handleConnectClick}
                className={classNames(
                  `px-3 py-2 w-full rounded-md text-sm font-medium`,
                  'bg-[#000]',
                  'hover:bg-[#000]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                )}
              >
                Connect to Supabase
              </button>
            ) : (
              <button
                onClick={() => executeSupabaseAction(content)}
                disabled={isExecuting}
                className={classNames(
                  `px-3 py-2 rounded-[15px] text-sm font-medium`,
                  'bg-[#000] w-full',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-[#E4E4E4] text-sm justify-center',
                  'flex items-center gap-1.5',
                  isExecuting ? 'opacity-70 cursor-not-allowed' : '',
                )}
              >
                {isExecuting ? 'Applying...' : 'Apply Changes'}
              </button>
            )}
            <button
              onClick={clearAlert}
              disabled={isExecuting}
              className={classNames(
                `px-3 py-2 rounded-[12px] text-sm font-medium`,
                'bg-[#EEE]',
                'hover:bg-[#CCC]',
                'focus:outline-none',
                'text-[#000]',
                isExecuting ? 'opacity-70 cursor-not-allowed' : '',
              )}
            >
              Dismiss
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
