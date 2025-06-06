// Messages.client.tsx
import type { Message } from 'ai';
import { Fragment, forwardRef } from 'react'; // forwardRef était déjà là, je l'ai juste groupé
import type { ForwardedRef } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';

// Anciens imports :
// import { db, chatId } from '~/lib/persistence/useChatHistory';

// Nouveaux imports :
import { chatIdAtom } from '~/lib/persistence/useChatHistory'; // Importer chatIdAtom
// db n'est plus nécessaire ici

import { forkChat as appwriteForkChat } from '~/lib/persistence/db'; // Importer la version Appwrite de forkChat
import { databases as appwriteDatabases } from '~/lib/appwrite'; // Pour vérifier si Appwrite est prêt

import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { SiHeadspace } from 'react-icons/si';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [] } = props;
    const location = useLocation();
    const profile = useStore(profileStore);

    const handleRewind = (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    };

    const handleFork = async (messageId: string) => {
      try {
        const currentChatId = chatIdAtom.get(); // Utiliser chatIdAtom.get()

        if (!appwriteDatabases || !currentChatId) { // Vérifier appwriteDatabases et currentChatId
          toast.error('Chat persistence or current chat ID is not available');
          return;
        }

        // appwriteForkChat ne prend plus db, mais l'ID du chat à forker (métier ou urlId) et messageId
        const urlId = await appwriteForkChat(currentChatId, messageId);
        window.location.href = `/chat/${urlId}`;
      } catch (error) {
        toast.error('Failed to fork chat: ' + (error instanceof Error ? error.message : "Unknown error"));
        console.error("Fork chat error:", error);
      }
    };

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, content, id: messageIdFromContent, annotations } = message; // Renommé pour éviter conflit avec props.id
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
              const isLast = index === messages.length - 1;
              const isHidden = annotations?.includes('hidden');

              if (isHidden) {
                return <Fragment key={messageIdFromContent || index} />; // Utiliser un ID unique si disponible
              }

              return (
                <div
                  key={messageIdFromContent || index} // Utiliser un ID unique si disponible
                  className={classNames('flex gap-4 p-6 py-5 w-full rounded-[calc(0.75rem-1px)]', {
                    'border border-[#EEE] dark:border-gray-700': isUserMessage || !isStreaming || (isStreaming && !isLast), // Ajouté dark mode border
                    '': isStreaming && isLast, // Cette classe vide peut être retirée si elle ne fait rien
                    'mt-4': !isFirst,
                  })}
                >
                  {isUserMessage ? ( // Avatar pour UserMessage
                    <div className="flex items-center justify-center w-[40px] h-[40px] rounded-[12px] border border-[#EEE] dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 shrink-0 self-start">
                      {profile?.avatar ? (
                        <img src={profile.avatar} alt={profile.username || "User"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="relative"> {/* Enveloppez l'SVG pour le centrage si nécessaire */}
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 10.0196C14.6358 10.3431 10.3431 14.6358 10.0196 20H9.98042C9.65687 14.6358 5.36425 10.3431 0 10.0196V9.98043C5.36425 9.65688 9.65687 5.36424 9.98042 0H10.0196C10.3431 5.36424 14.6358 9.65688 20 9.98043V10.0196Z" fill="url(#paint0_radial_user_avatar)"/>
                                <defs>
                                    <radialGradient id="paint0_radial_user_avatar" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-6.13727 9.97493) scale(21.6266 172.607)">
                                        <stop offset="0.385135" stop-color="#9E72BA"/>
                                        <stop offset="0.734299" stop-color="#D65C67"/>
                                        <stop offset="0.931035" stop-color="#D6635C"/>
                                    </radialGradient>
                                </defs>
                            </svg>
                        </div>
                      )}
                    </div>
                  ) : ( // Avatar pour AssistantMessage
                    <div className="relative flex items-center justify-center w-[40px] h-[40px] shrink-0 self-start">
                        {/* L'icône SiHeadspace pourrait être l'avatar de l'assistant */}
                        <SiHeadspace size={24} className="text-gray-700 dark:text-gray-300"/>
                         {/* Ou un SVG si vous préférez, comme pour l'utilisateur mais avec un ID de gradient différent */}
                    </div>
                  )}

                  <div className="grid grid-cols-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={content} />
                    ) : (
                      <AssistantMessage
                        content={content}
                        annotations={message.annotations}
                        messageId={messageIdFromContent} // S'assurer que c'est bien l'ID du message actuel
                        onRewind={handleRewind}
                        onFork={handleFork}
                      />
                    )}
                  </div>
                </div>
              );
            })
          : null}
        {isStreaming && ( // Loader pour le streaming
          <div className="flex justify-center items-center w-full py-5">
            <div className="text-bolt-elements-item-contentAccent i-svg-spinners:3-dots-fade text-4xl"></div>
          </div>
        )}
      </div>
    );
  },
);

Messages.displayName = 'Messages'; // Utile pour le débogage React DevTools
