/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { Messages } from './Messages.client';
import { getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';
import type { ProviderInfo } from '~/types/model';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert, SupabaseAlert, DeployAlert } from '~/types/actions';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import type { ActionRunner } from '~/lib/runtime/action-runner';
import { SupabaseChatAlert } from '~/components/chat/SupabaseAlert';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { useStore } from '@nanostores/react';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Client, Databases, ID, Query } from 'appwrite';
import { useNavigate } from '@remix-run/react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { formatDistanceToNow } from 'date-fns';


const client = new Client();
client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('679d739b000950dfb1e0');

const databases = new Databases(client);


const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  supabaseAlert?: SupabaseAlert;
  clearSupabaseAlert?: () => void;
  deployAlert?: DeployAlert;
  clearDeployAlert?: () => void;
  data?: JSONValue[] | undefined;
  actionRunner?: ActionRunner;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  append?: (message: Message) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: (element: ElementInfo | null) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      deployAlert,
      clearDeployAlert,
      supabaseAlert,
      clearSupabaseAlert,
      data,
      actionRunner,
      chatMode,
      setChatMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const expoUrl = useStore(expoUrlAtom);
    const [qrModalOpen, setQrModalOpen] = useState(false);

                                                   
    const [userId, setUserId] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<any | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [error, setError] = useState<string>('');
    const [isSubscriptionValid, setIsSubscriptionValid] = useState<boolean>(false);
    const [showPlanContainer, setShowPlanContainer] = useState<boolean>(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
     const navigate = useNavigate();

    // Paramètres de la base de données et de la collection Appwrite (à configurer dans .env)
    const databaseId = 'Boodupy-database-2025';
    const collectionId = 'apps-200900';

    const checkSubscriptionValidity = (subscription: any) => {
        if (subscription && subscription.expirationDate) {
            const expirationDate = new Date(subscription.expirationDate);
            const now = new Date();
    
            if (expirationDate > now) {
                setIsSubscriptionValid(true); // l'abonnement est valide
                const timeLeft = expirationDate.getTime() - now.getTime();
                setTimeRemaining(timeLeft); // Temps restant en millisecondes
            } else {
                setIsSubscriptionValid(false); // l'abonnement a expiré
                setTimeRemaining(0); // Pas de temps restant
                navigate('/subscription');
            }
        } else {
            setIsSubscriptionValid(false); // Pas d'abonnement ou date d'expiration
            setTimeRemaining(0); // Pas de temps restant
        }
    };

    const fetchSubscription = async (userId: string) => {
        try {
            const response = await databases.listDocuments(
                'Boodupy-database-2025',
                'subscriptions-200900',
                [
                    Query.equal('userId', userId),
                ]
            );
    
            if (response.documents.length > 0) {
                const subscriptionData = response.documents[0];
                setSubscription(subscriptionData);
    
                // Vérifier la validité de l'abonnement et calculer le temps restant
                checkSubscriptionValidity(subscriptionData);
            } else {
                // Aucun abonnement trouvé pour cet utilisateur
                setSubscription(null);
                setIsSubscriptionValid(false); // Définir l'état sur false si aucun abonnement n'est trouvé
            }
    
        } catch (error) {
            console.error("Erreur lors de la récupération de l'abonnement :", error);
            setError("Erreur lors du chargement de l'abonnement.");
            setSubscription(null); // S'assurer que l'état est null en cas d'erreur
            setIsSubscriptionValid(false); // Définir l'état sur false en cas d'erreur
        }
    };

    const toggleUserMenu = () => {
        setIsUserMenuOpen(!isUserMenuOpen);
    };

    const showSubscriptionDetails = () => {
        setShowPlanContainer(true); // Affiche PlanContainer
        setIsUserMenuOpen(false);   // Ferme le menu utilisateur
    };

    
useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setUserId(storedUserId);
            
             fetchSubscription(storedUserId); // Nouvelle fonction pour récupérer l'abonnement
        } else {
             navigate('/signup');
         }
     }, [navigate]);


  const PlanContainer = ({ userId, subscription, fetchSubscription, isSubscriptionValid, setShowPlanContainer, timeLeftString, className }: {
    userId: string | null;
    subscription: any;
    fetchSubscription: (userId: string) => Promise<void>,
    isSubscriptionValid: boolean,
    setShowPlanContainer: React.Dispatch<React.SetStateAction<boolean>>
    timeLeftString: string
    className: string // Ajout de la prop className
}) => {
    const [sdkReady, setSdkReady] = useState(false);
    const [discountCode, setDiscountCode] = useState('');

    const handleCloseContainer = () => {
        setShowPlanContainer(false); // Réinitialise showPlanContainer
    }

    const handleAppyDiscount = () => {

    }

    const initialOptions = {
        clientId: "AYvPy5jTSvgSKnkb883xjro4-LyVoN7OueY_UWzD27Qc-ODHs5yhMRT-DO7Fu4sfptv8xCG7wh5q9rXX",
        currency: "USD",
        intent: "capture",
    };

    // Fonction pour mettre à jour l'abonnement dans Appwrite
    const updateSubscription = async (userId: string) => {
        try {
            // Calculer la nouvelle date d'expiration (30 jours à partir de maintenant)
            const newExpirationDate = new Date();
            newExpirationDate.setDate(newExpirationDate.getDate() + 30);

            // Préparer les données à mettre à jour
            const updateData = {
                subscriptionType: 'plan', // Changer le type d'abonnement
                expirationDate: newExpirationDate.toISOString() // Nouvelle date d'expiration
            };
            console.log(subscription);
            // Mettre à jour le document dans Appwrite
            await databases.updateDocument('Boodupy-database-2025', 'subscriptions-200900', subscription.$id, updateData);
            console.log('Abonnement mis à jour avec succès dans Appwrite.');
            // Rafraîchir les données d'abonnement
            fetchSubscription(userId);
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'abonnement dans Appwrite :', error);
            setError("Erreur lors de la mise à jour de l'abonnement.");
        }
    };

    return (
        <div className={`fixed bottom-0  h-full left-0 right-0 z-[9999] w-full ${className}`}> {/* Utilisation de className */}
            <div className="absolute  flex-col  overflow-y-auto md:flex-row lg:flex-row bottom-0 bg-white h-[80%] md:h-[60%] lg:h-[60%] rounded-t-[15px] p-2 w-full border-t flex items-center justify-center gap-3 border-[#EEE]">
            <button
                onClick={handleCloseContainer}
                style={{ border: "1px solid #EEE" }}
                className={`bg-[#FAFAFA] absolute top-4 left-6 text-gray-700 p-1 h-[35px] w-[35px] flex items-center justify-center rounded-full mr-2 ${isSubscriptionValid ? '' : 'sr-only'}`}
            >
                <X color='#888'></X>
            </button>
                <div className='h-[90%]  flex flex-col gap-2 p-3 w-[90%] lg:w-[40%] md:w-[40%] border border-[#EEE] rounded-[20px]'>
                    <div className="flex items-center gap-2">
                        <h2 className=" text-3xl">Pro</h2>
                        <div className="py-1 px-2 rounded-[12px] select-none text-white bg-blue-600 text-sm h-[30px] flex items-center justify-center">upgrade</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-5xl font-semibold">$10</h2>
                        <p className='font-medium'>/month</p>
                    </div>
                    <ul className="flex flex-col">
                        <li className='flex text-compact gap-x-2 py-2 items-center gap-[2px]'>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="pointer-events-none size-20 shrink-2 h-[24px] w-[24px]" data-sentry-element="svg" data-sentry-component="UnlockedIcon" data-sentry-source-file="UnlockedIcon.tsx"><path d="M10 11V15" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" data-sentry-element="path" data-sentry-source-file="UnlockedIcon.tsx"></path><path d="M16 8H4V15L7 18H13L16 15V8Z" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" data-sentry-element="path" data-sentry-source-file="UnlockedIcon.tsx"></path><path d="M7 8V4C7 2.34315 8.34315 1 10 1V1C11.6569 1 13 2.34315 13 4V4.5" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" data-sentry-element="path" data-sentry-source-file="UnlockedIcon.tsx"></path></svg>
                            <p className="font-semibold relative top-[1px] ">Build unlimited apps and websites</p>
                        </li>
                        <li className='flex text-compact gap-x-2 py-2 items-center gap-[2px]'>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="pointer-events-none size-20 shrink-2 h-[24px] w-[24px]" data-sentry-element="svg" data-sentry-component="FlowIcon" data-sentry-source-file="FlowIcon.tsx"><title>flow icon</title><path d="M4 17C5.65685 17 7 15.6569 7 14C7 12.3431 5.65685 11 4 11C2.34315 11 1 14C1 15.6569 2.34315 17 4 17Z" fill="currentColor" data-sentry-element="path" data-sentry-source-file="FlowIcon.tsx"></path><path d="M13 3H16H19V6V9H16H13V6V3Z" fill="currentColor" data-sentry-element="path" data-sentry-source-file="FlowIcon.tsx"></path><path d="M4 9V7C4 5.34315 5.34315 4 7 4C8.65685 4 10 5.34315 10 7V13C10 14.6569 11.3431 16 13 16C14.6569 16 16 14.6569 16 13V11" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" data-sentry-element="path" data-sentry-source-file="FlowIcon.tsx"></path></svg>
                            <p className="font-semibold relative top-[1px] ">No messages or tokens limits</p>
                        </li>
                        <li className='flex text-compact gap-x-2 py-2 items-center gap-[2px]'>
                            <Globe></Globe>
                            <p className="font-semibold relative top-[1px] ">Fast deploy online.</p>
                        </li>

                    </ul>
                    {/* Conditional Button on PlanContainer */}
                    {isSubscriptionValid ? (
                        <button className="h-[48px]  max-w-[240px] text-[#E4E4E4] rounded-[25px] bg-black flex items-center justify-center py-5 px-8">pay soon in {timeLeftString}</button>
                    ) : (
                        <PayPalScriptProvider options={initialOptions}>
                            <PayPalButtons
                                createOrder={(data, actions) => {
                                    return actions.order.create({
                                        intent: 'CAPTURE', // Ajout de l'intent
                                        purchase_units: [{
                                            amount: {
                                                currency_code: "USD",
                                                value: "10",
                                            },
                                        }],
                                    });
                                }}
                                onApprove={async (data, actions) => {
                                    const details = await actions.order?.capture();
                                    if (details) { // Vérifie si details existe
                                        alert("Transaction completed by " + details.payer?.name?.given_name);
                                        if (userId) {
                                            updateSubscription(userId);
                                        }
                                    } else {
                                        console.error("La capture de l'ordre a échoué.");
                                        setError("La transaction PayPal a échoué.");
                                    }
                                }}
                            />
                        </PayPalScriptProvider>
                    )
                    }
                </div>
                <div className='h-[90%] flex flex-col gap-2 p-3 w-[90%] lg:w-[40%] md:w-[40%] border border-[#EEE] rounded-[12px]'>
                    <h1 className="text-4xl font-semibold">Apply Discount.</h1>
                    <p className="font-semibold text-1xl text-[#888]"> Apply an discount code to reduce the amount that you will pay on a billing cycle. Pay less and beneficits of all pro features and accessibilities.</p>
                    <div>
                        <input
                            type="text"
                            placeholder="Discount Code"
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value)}
                            className="w-full px-3 py-3 bg-white border-2 border-[#EEE] placeholder:text-black focus-visible:border-[#888] focus-visible:border-4  rounded-[15px]  text-base mb-4"
                        />
                    </div>
                    <button onClick={handleAppyDiscount} className="h-[48px] max-w-[100%] lg:max-w-[240px] text-[#E4E4E4] rounded-[25px] bg-black flex items-center justify-center py-5 px-8">Apply Code</button>
                </div>
                <div>

                </div>
            </div>
        </div>
    )
}

const UpgradeTimer = ({ timeRemaining, isSubscriptionValid }: { timeRemaining: number | null, isSubscriptionValid: boolean }) => {
    if (!isSubscriptionValid || timeRemaining === null || timeRemaining <= 0) {
        return null;
    }

    const timeLeftString = formatDistanceToNow(new Date(Date.now() + timeRemaining), {
        addSuffix: true,
    });

    // Calcul du pourcentage de temps restant
    const totalTime = 30 * 24 * 60 * 60 * 1000; // 30 jours en millisecondes (exemple)
    const timeElapsed = totalTime - timeRemaining;
    const progress = Math.min(1, timeElapsed / totalTime); // S'assure que la progression ne dépasse pas 1

    return (
        <div className='fixed bottom-5 right-4 p-4 h-auto w flex flex-col gap-2 w-[260px] border border-[#EEE] rounded-[15px]'>
            <div>
                <p className="font-semibold"><span className="text-sm">🚀</span> Your trial ends {timeLeftString}</p>
            </div>
            <div className="sr-only gap-1  justify-center w-full items-center">
                {[...Array(4)].map((_, index) => {
                    const barProgress = Math.min(1, progress * 4 - index); // Progression pour chaque barre
                    const bgColor = barProgress > 0 ? 'bg-black' : 'bg-[#EEE]';
                    return (
                        <div
                            key={index}
                            className={`h-[5px] w-[50px] rounded-[8px] ${bgColor}`}
                            style={{
                                width: '50px',
                                backgroundColor: barProgress > 0 ? '#000' : '#EEE',
                                opacity: barProgress > 0 ? 1 : 1,
                            }}
                        />
                    );
                })}
            </div>
            <a className="flex group items-center gap-x-2 rounded-full bg-black px-7.5 py-3 text-md font-semibold text-white shadow-xs outline-none hover:-translate-y-0.5 transition hover:scale-[100.5%] hover:bg-black/90" href="https://github.com/cluely/releases/releases/latest/download/cluely.dmg">
<video src="https://cdn.cosmos.so/fd42f4c6-0e00-46c3-98a7-9db1f94b1b71.mp4" autoPlay muted className="h-[25px] w-[25px]"></video><span className="group-hover:text-sky-50 transition">Upgrade to pro</span></a>
        </div>
    );
};


    

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        setSelectedElement?.(null);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[16vh] max-w-2xl mx-auto text-center px-4 lg:px-0">
                <h1 className="text-4xl lg:text-7xl font-bold text-bolt-elements-textPrimary mb-4 animate-fade-in">
                 Your dreaming app. Build in minutes.
                </h1>
               
              </div>
            )}
            <StickToBottom
              className={classNames('pt-6 px-2 sm:px-6 relative', {
                'h-full flex flex-col modern-scrollbar': chatStarted,
              })}
              resize="smooth"
              initial="smooth"
            >
              <StickToBottom.Content className="flex flex-col gap-4 relative ">
                <ClientOnly>
                  {() => {
                    return chatStarted ? (
                      <Messages
                        className="flex flex-col w-full flex-1 max-w-chat pb-4 mx-auto z-1"
                        messages={messages}
                        isStreaming={isStreaming}
                        append={append}
                        chatMode={chatMode}
                        setChatMode={setChatMode}
                        provider={provider}
                        model={model}
                      />
                    ) : null;
                  }}
                </ClientOnly>
                <ScrollToBottom />
              </StickToBottom.Content>
              <div
                className={classNames('my-auto flex flex-col gap-2 w-full max-w-chat mx-auto z-prompt mb-6', {
                  'sticky bottom-2': chatStarted,
                })}
              >
                <div className="flex flex-col gap-2">
                  {deployAlert && (
                    <DeployChatAlert
                      alert={deployAlert}
                      clearAlert={() => clearDeployAlert?.()}
                      postMessage={(message: string | undefined) => {
                        sendMessage?.({} as any, message);
                        clearSupabaseAlert?.();
                      }}
                    />
                  )}
                  {supabaseAlert && (
                    <SupabaseChatAlert
                      alert={supabaseAlert}
                      clearAlert={() => clearSupabaseAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.({} as any, message);
                        clearSupabaseAlert?.();
                      }}
                    />
                  )}
                  {actionAlert && (
                    <ChatAlert
                      alert={actionAlert}
                      clearAlert={() => clearAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.({} as any, message);
                        clearAlert?.();
                      }}
                    />
                  )}
                </div>
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                <ChatBox
                  isModelSettingsCollapsed={isModelSettingsCollapsed}
                  setIsModelSettingsCollapsed={setIsModelSettingsCollapsed}
                  provider={provider}
                  setProvider={setProvider}
                  providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                  model={model}
                  setModel={setModel}
                  modelList={modelList}
                  apiKeys={apiKeys}
                  isModelLoading={isModelLoading}
                  onApiKeysChange={onApiKeysChange}
                  uploadedFiles={uploadedFiles}
                  setUploadedFiles={setUploadedFiles}
                  imageDataList={imageDataList}
                  setImageDataList={setImageDataList}
                  textareaRef={textareaRef}
                  input={input}
                  handleInputChange={handleInputChange}
                  handlePaste={handlePaste}
                  TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
                  TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
                  isStreaming={isStreaming}
                  handleStop={handleStop}
                  handleSendMessage={handleSendMessage}
                  enhancingPrompt={enhancingPrompt}
                  enhancePrompt={enhancePrompt}
                  isListening={isListening}
                  startListening={startListening}
                  stopListening={stopListening}
                  chatStarted={chatStarted}
                  exportChat={exportChat}
                  qrModalOpen={qrModalOpen}
                  setQrModalOpen={setQrModalOpen}
                  handleFileUpload={handleFileUpload}
                  chatMode={chatMode}
                  setChatMode={setChatMode}
                  designScheme={designScheme}
                  setDesignScheme={setDesignScheme}
                  selectedElement={selectedElement}
                  setSelectedElement={setSelectedElement}
                />
              </div>
            </StickToBottom>
            <div className="flex flex-col justify-center">
              {!chatStarted && (
                <div className="sr-only justify-center gap-2">
                  {ImportButtons(importChat)}
                  <GitCloneButton importChat={importChat} />
                </div>
              )}
              <div className="flex flex-col gap-5">
                {!chatStarted &&
                  ExamplePrompts((event, messageInput) => {
                    if (isStreaming) {
                      handleStop?.();
                      return;
                    }

                    handleSendMessage?.(event, messageInput);
                  })}
                {!chatStarted && <StarterTemplates />}
              </div>
            </div>
          </div>
          <ClientOnly>
            {() => (
              <Workbench
                actionRunner={actionRunner ?? ({} as ActionRunner)}
                chatStarted={chatStarted}
                isStreaming={isStreaming}
                setSelectedElement={setSelectedElement}
              />
            )}
          </ClientOnly>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <>
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-bolt-elements-background-depth-1 to-transparent h-20 z-10" />
        <button
          className="sticky z-50 bottom-0 left-0 right-0 text-4xl rounded-lg px-1.5 py-0.5 flex items-center justify-center mx-auto gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
          onClick={() => scrollToBottom()}
        >
          Go to last message
          <span className="i-ph:arrow-down animate-bounce" />
        </button>
      </>
    )
  );
}
