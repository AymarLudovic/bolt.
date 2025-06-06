import type { Message } from 'ai';
import { Fragment } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
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
        if (!db || !chatId.get()) {
          toast.error('Chat persistence is not available');
          return;
        }

        const urlId = await forkChat(db, chatId.get()!, messageId);
        window.location.href = `/chat/${urlId}`;
      } catch (error) {
        toast.error('Failed to fork chat: ' + (error as Error).message);
      }
    };

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, content, id: messageId, annotations } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
              const isLast = index === messages.length - 1;
              const isHidden = annotations?.includes('hidden');

              if (isHidden) {
                return <Fragment key={index} />;
              }

              return (
                <div
                  key={index}
                  className={classNames('flex gap-4 p-6 py-5 w-full rounded-[calc(0.75rem-1px)]', {
                    ' border-[#EEE]': isUserMessage || !isStreaming || (isStreaming && !isLast),
                    '':
                      isStreaming && isLast,
                    'mt-4': !isFirst,
                  })}
                >
                  {isUserMessage && (
                    <div className="flex items-center justify-center  overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500  shrink-0 self-start">
                      {profile?.avatar ? (
                        
                        <div className='w-[40px] h-[40px] rounded-[12px] border border-[#EEE]'></div>
                      ) : (
                        <div className="relative ">
     <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 10.0196C14.6358 10.3431 10.3431 14.6358 10.0196 20H9.98042C9.65687 14.6358 5.36425 10.3431 0 10.0196V9.98043C5.36425 9.65688 9.65687 5.36424 9.98042 0H10.0196C10.3431 5.36424 14.6358 9.65688 20 9.98043V10.0196Z" fill="url(#paint0_radial_809_11874)"/>
            <defs>
                <radialGradient id="paint0_radial_809_11874" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-6.13727 9.97493) scale(21.6266 172.607)">
                    <stop offset="0.385135" stop-color="#9E72BA"/>
                    <stop offset="0.734299" stop-color="#D65C67"/>
                    <stop offset="0.931035" stop-color="#D6635C"/>
                </radialGradient>
            </defs>
        </svg>
   </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-col-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={content} />
                    ) : (

                <div className=' flex items-start gap-2 '>
                  <div className="relative  flex items-center gap-1 -left-[5px]">
                    <svg className='h-[24px] sr-only w-[24px]' viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 10.0196C14.6358 10.3431 10.3431 14.6358 10.0196 20H9.98042C9.65687 14.6358 5.36425 10.3431 0 10.0196V9.98043C5.36425 9.65688 9.65687 5.36424 9.98042 0H10.0196C10.3431 5.36424 14.6358 9.65688 20 9.98043V10.0196Z" fill="url(#paint0_radial_809_11874)"/>
                            <defs>
                                <radialGradient id="paint0_radial_809_11874" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-6.13727 9.97493) scale(21.6266 172.607)">
                                    <stop offset="0.385135" stop-color="#9E72BA"/>
                                    <stop offset="0.734299" stop-color="#D65C67"/>
                                    <stop offset="0.931035" stop-color="#D6635C"/>
                                </radialGradient>
                            </defs>
                        </svg>
                       
                        <SiHeadspace size={16}></SiHeadspace>
         
                  </div>

   <AssistantMessage
                        content={content}
                        annotations={message.annotations}
                        messageId={messageId}
                        onRewind={handleRewind}
                        onFork={handleFork}
                      />
                  </div>
                      
                      
                    )}
                  </div>
                  
                </div>
              );
            })
          : null}
        {isStreaming && (
          <div className="text-center w-full  text-bolt-elements-item-contentAccent i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}
      </div>
    );
  },
);
