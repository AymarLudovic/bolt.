import React, { useState, useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { SiHeadspace } from 'react-icons/si';
import { Sidebar } from 'lucide-react';
import { chatStore } from '~/lib/stores/chat';

export function Header() {
  const chat = useStore(chatStore);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
        setUserId(storedUserId);
        
        console.log('user found' + storedUserId) // Nouvelle fonction pour récupérer l'abonnement
    } else {
      console.log('user not found') 
     }
 }, []);

 const handleLogout = () => {
  localStorage.removeItem('userId'); // Supprimer l'ID utilisateur du localStorage
  setUserId(null); // Mettre à jour l'état local
  navigate('/signup'); // Rediriger vers la page d'inscription/connexion
};

  return (
    <header
      className={classNames('flex items-center p-5 border-b w-full  top-0 justify-between h-[var(--header-height)] left-0', {
        'border-transparent': !chat.started,
        'border-none': chat.started,
      })}
    >
      <div className="flex items-center gap-4 z-logo text-bolt-elements-textPrimary cursor-pointer ">
      {/* <Sidebar size={18}></Sidebar> */}
      {/* <svg className="pointer-events-none h-[24px] w-[24px]" data-testid="geist-icon" height="24"  strokeLinejoin="round" style={{ color: "currentcolor", }} viewBox="0 0 16 16" width="16"> <path clipRule="evenodd" d="M12.8536 8.7071C13.2441 8.31657 13.2441 7.68341 12.8536 7.29288L9.03034 3.46966L8.50001 2.93933L7.43935 3.99999L7.96968 4.53032L11.4393 7.99999L7.96968 11.4697L7.43935 12L8.50001 13.0607L9.03034 12.5303L12.8536 8.7071ZM7.85356 8.7071C8.24408 8.31657 8.24408 7.68341 7.85356 7.29288L4.03034 3.46966L3.50001 2.93933L2.43935 3.99999L2.96968 4.53032L6.43935 7.99999L2.96968 11.4697L2.43935 12L3.50001 13.0607L4.03034 12.5303L7.85356 8.7071Z" fill="currentColor" fillRule="evenodd" /> </svg> */}
        <a href="/" className="text-2xl font-semibold text-accent flex gap-1 items-center">
          {/* <span className="i-bolt:logo-text?mask w-[46px] inline-block" /> */}
         
          <SiHeadspace size={18}></SiHeadspace>
          <span className='font-semibold'>Studio</span>
        </a>
      </div>
      
      {chat.started &&  ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1  justify-center items-center px-4 ">
            <div className="flex w-full items-center justify-center">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
            </div>
          </span>
          <ClientOnly>
            {() => (
              <div className="mr-1">
                <HeaderActionButtons />
              </div>
            )}
          </ClientOnly>
          {userId && (
          <button onClick={handleLogout} style={{border: "1px solid #EEE"}} className='w-[150px] flex h-[38px] justify-center bg-[#fff]  items-center gap-2 py-1 px-2 border border-[#888] rounded-[13px]'>
          <span>Log out</span>
         
        </button>
        )}
        </>
        
      )}

{!chat.started &&  ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          
          {userId && (
          <button onClick={handleLogout} style={{border: "1px solid #EEE"}} className='w-[150px] bg-[#fff] h-[38px] justify-center flex items-center gap-2 py-1 px-2 border border-[#888] rounded-[13px]'>
          <span>Log out</span>
         
        </button>
        )}
        </>
        
      )}


    </header>
  );
}
