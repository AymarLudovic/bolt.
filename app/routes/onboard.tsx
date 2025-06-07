import { useState, useEffect } from 'react';
import { Plus, LogOut, Globe, X, User2, CreditCard,  } from 'lucide-react'; // Import LogOut pour l'icône de déconnexion
import { Client, Databases, ID, Query } from 'appwrite';
import { formatDistanceToNow } from 'date-fns';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useNavigate } from '@remix-run/react';

// Initialiser Appwrite (assurez-vous que ces valeurs sont correctes et dans un .env)
const client = new Client();
client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('679d739b000950dfb1e0');

const databases = new Databases(client);

const Onboard = () => {
    const [appName, setAppName] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [userApps, setUserApps] = useState<any[]>([]);
    const [error, setError] = useState<string>('');
    const [userId, setUserId] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<any | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [isSubscriptionValid, setIsSubscriptionValid] = useState<boolean>(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
    const [showPlanContainer, setShowPlanContainer] = useState<boolean>(false);
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

    // UseEffect pour vérifier si l'utilisateur est connecté (via localStorage)
    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setUserId(storedUserId);
            fetchUserApps(storedUserId);
            fetchSubscription(storedUserId); // Nouvelle fonction pour récupérer l'abonnement
        } else {
            navigate('/signup');
        }
    }, [navigate]); // Ajout de navigate comme dépendance

    // Fonction pour récupérer les applications de l'utilisateur depuis Appwrite
    const fetchUserApps = async (userId: string) => {
        try {
            const response = await databases.listDocuments(
                databaseId,
                collectionId,
                [
                    Query.equal('userId', userId),
                ]
            );
            setUserApps(response.documents);
        } catch (err: any) {
            console.error("Erreur lors de la récupération des applications :", err);
            setError("Erreur lors du chargement des applications.");
        }
    };

    // Fonction pour ouvrir la modal de création d'application
    const handleCreateAppClick = () => {
        setIsModalOpen(true);
    };

    // Fonction pour fermer la modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setAppName('');
        setError('');
    };

    // Fonction pour créer une nouvelle application dans Appwrite
    const handleCreateApp = async () => {
        if (!appName) {
            setError("Le nom de l'application est obligatoire.");
            return;
        }

        if (!userId) {
            setError("Utilisateur non connecté.");
            return;
        }

        try {
            // Créer le document dans Appwrite
            const newApp = await databases.createDocument(
                databaseId,
                collectionId,
                ID.unique(),
                {
                    userId: userId,
                    name: appName,
                }
            );

            // Fermer la modal
            setIsModalOpen(false);
            setAppName('');

            // Rediriger vers la page du builder avec l'ID de l'application
            navigate(`/${newApp.$id}/builder`);
        } catch (err: any) {
            console.error("Erreur lors de la création de l'application :", err);
            setError("Erreur lors de la création de l'application.");
        }
    };

    // Fonction pour gérer la déconnexion
    const handleLogout = () => {
        localStorage.removeItem('userId'); // Supprimer l'ID utilisateur du localStorage
        setUserId(null); // Mettre à jour l'état local
        navigate('/signup'); // Rediriger vers la page d'inscription/connexion
    };

    const GeminiIcon = () => (
        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 10.0196C14.6358 10.3431 10.3431 14.6358 10.0196 20H9.98042C9.65687 14.6358 5.36425 10.3431 0 10.0196V9.98043C5.36425 9.65688 9.65687 5.36424 9.98042 0H10.0196C10.3431 5.36424 14.6358 9.65688 20 9.98043V10.0196Z" fill="url(#paint0_radial_809_11874)"/>
            <defs>
                <radialGradient id="paint0_radial_809_11874" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-6.13727 9.97493) scale(21.6266 172.607)">
                    <stop offset="0.385135" stop-color="#9E72BA"/>
                    <stop offset="0.734299" stop-color="#D65C67"/>
                    <stop offset="0.931035" stop-color="#D6635C"/>
                </radialGradient>
            </defs>
        </svg>
    );


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
            clientId: "AfUVt7FlKnS-R6INQXaNCKVgZM2VrHj6r9-gP2vG_bg-PrgJ5olkVJfeoP6NZW5w3bn4oHLf8EsRVqze",
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
            <div className='fixed bottom-5 right-4 p-4 h-auto flex flex-col gap-2 w-[260px] border border-[#EEE] rounded-[15px]'>
                <div>
                    <p className="font-semibold"><span className="text-sm">🚀</span> Your trial ends {timeLeftString}</p>
                </div>
                <div className="flex gap-1 justify-center w-full items-center">
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
                {isSubscriptionValid && <button className="h-[30px] w-auto text-[#E4E4E4] rounded-lg bg-black flex items-center justify-center py-5 px-8">Upgrade to $10 plan</button>}
            </div>
        );
    };

    // const UpgradeTimer = () => (
    //     <div className='fixed bottom-5 right-4 p-4 h-auto flex flex-col gap-2 w-[260px] border border-[#EEE] rounded-[15px]'>
    //         <div>
    //             <p className="font-semibold"><span className="text-sm">🚀</span>  Your trial ends in 3 days</p>
    //         </div>
    //         <div className="flex gap-1 justify-center w-full items-center">
    //             <div className='h-[5px] w-[50px] rounded-[8px] bg-black'></div>
    //             <div className='h-[5px] w-[50px] rounded-[8px] bg-[#EEE]'></div>
    //             <div className='h-[5px] w-[50px] rounded-[8px] bg-[#EEE]'></div>
    //             <div className='h-[5px] w-[50px] rounded-[8px] bg-[#EEE]'></div>
    //         </div>
    //         <div className='flex items-center justify-center w-full'>
    //            <p className="text-sm font-semibold">Upgrade to the pro plan to continue to use Boodupy an build your apps.</p>
              
    //         </div>
    //         <button className="h-[30px] w-auto text-[#E4E4E4] rounded-lg bg-black flex items-center justify-center py-5 px-8">Upgrade to $10 plan</button>
    //     </div>
    // );
   
    const timeLeftString = timeRemaining !== null ? formatDistanceToNow(new Date(Date.now() + timeRemaining), { addSuffix: true }) : "";

    return (
        <div className='h-screen w-full text-black overflow-hidden' style={{ fontFamily: 'Funnel Display' }} >
              {/* Afficher PlanContainer uniquement si showPlanContainer est true ET si l'abonnement n'est pas valide */}
              <PlanContainer
        userId={userId}
        subscription={subscription}
        fetchSubscription={fetchSubscription}
        isSubscriptionValid={isSubscriptionValid}
        setShowPlanContainer={setShowPlanContainer}
        timeLeftString={timeLeftString}
        className={`${(showPlanContainer || !isSubscriptionValid) ? '' : 'hidden'}`}
    />

         <div className='fixed flex  bottom-5 left-[45%] px-2 py-2 backdrop-blur-3xl rounded-full fle items-center gap-3'>
            <a href="/onboard" className='sr-only'>
            <svg width="2em" data-e2e="" height="2em" viewBox="0 0 48 48" fill="#888" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M24.9505 7.84001C24.3975 7.38666 23.6014 7.38666 23.0485 7.84003L6.94846 21.04C6.45839 21.4418 6.2737 22.1083 6.48706 22.705C6.70041 23.3017 7.26576 23.7 7.89949 23.7H10.2311L11.4232 36.7278C11.5409 38.0149 12.6203 39 13.9128 39H21.5C22.0523 39 22.5 38.5523 22.5 38V28.3153C22.5 27.763 22.9477 27.3153 23.5 27.3153H24.5C25.0523 27.3153 25.5 27.763 25.5 28.3153V38C25.5 38.5523 25.9477 39 26.5 39H34.0874C35.3798 39 36.4592 38.0149 36.577 36.7278L37.7691 23.7H40.1001C40.7338 23.7 41.2992 23.3017 41.5125 22.705C41.7259 22.1082 41.5412 21.4418 41.0511 21.04L24.9505 7.84001Z"></path></svg>
            </a>
            
            <button onClick={handleCreateAppClick} className="h-[48px]  max-w-[240px] text-[#E4E4E4] rounded-[25px] gap-1 bg-black flex items-center justify-center py-5 px-8"><Plus size={18}></Plus> Add new app</button>
            <a href="/onboard/cms" className='sr-only'>
            <Globe width="1.5em" height="1.5em" color='gray'></Globe>
            </a>
        </div>
        {isSubscriptionValid && <UpgradeTimer timeRemaining={timeRemaining} isSubscriptionValid={isSubscriptionValid} />}
            <nav className="w-full flex top-0 sticky p-2 py-3 px-10  items-center justify-between">
                <a href="/">
                <h1 className="text-3xl font-semibold">Bood.</h1>
                </a>
                
                <div className="flex items-center gap-4 relative">
                    <div onClick={toggleUserMenu} className='h-[48px] flex items-center justify-center cursor-pointer w-[48px] border border-[#EEE] rounded-full'>
                    <User2></User2>
                    </div>
                    <div className={`absolute top-[110%] right-1 w-auto bg-white border border-[#EEE] rounded-[12px] ${isUserMenuOpen ? '' : 'hidden'}`}>
                    <button
    style={{ borderBottom: "1px solid #eee" }}
    onClick={showSubscriptionDetails} // Utilise la nouvelle fonction
    className="flex items-center justify-center relative gap-1 py-2 px-3 w-[250px] border border-b  h-[40px] border-[#EEE] font-semibold"
>
    <CreditCard size={18} className='absolute left-3' />
    <p className='absolute left-14'>My subscription</p>
</button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center relative gap-1 py-2 px-3 w-[250px] border h-[40px]  border-[#EEE] font-semibold"
                    >
                        <LogOut size={18}className='absolute  left-3' />
                        <p className='absolute  left-14'>Log out</p>
                    </button>
                    </div>
                    
                </div>

            </nav>
            <div className='w-[100%] h-[100vh] md:pl-12 flex items-center justify-center'>
            <div className='w-full h-full overflow-y-auto flex items-center justify-center  flex-wrap'>
            {userApps.map((app) => (
    <div key={app.$id} className="flex flex-col mb-12 gap-2 w-full">
        <a href={`${app.$id}/builder`}> {/* Modifier ici pour rediriger vers /builder */}
            <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-[50px] rounded-[15px] border border-[#EEE] h-[50px]">
                    {/* Placeholder pour l'icône de l'application */}
                    <img src="/icons/Artifact logo.png" className='h-full w-full rounded-[15px] object-contain' alt="" />
                </div>
                <div className="flex flex-col gap-1">
                <h2 className="text-1xl font-semibold ">
                    {app.name}
                </h2>
                
                </div>
            </div>
        </a>
        <div className='flex  bg-[#FFF] border rounded-[35px] border-[#EEE] md:h-[540px] w-[90%]'>

        </div>
        
    </div>
))}
            </div>
            </div>
            
             
            {error && <div className="text-red-500 text-center">{error}</div>}
            <section className="w-[100vw] h-[100vh] overflow-y-auto flex flex-col gap-5 ">
            
            <section className="w-full h-full  flex justify-center  items-center  flex-wrap" style={{gap: "44px 24px"}}>
          

                {/* Si aucune application n'est trouvée, afficher un message */}
                {userApps.length === 0 && (
                    <div className="text-gray-500 text-center">
                        No Apps found. Create one
                    </div>
                )}
            </section>
            </section>

            {/* Modal pour entrer le nom de l'application */}
            {isModalOpen && (
                <div className="fixed transition-all duration-600 top-0 left-0 w-full h-full  bg-opacity-50 flex items-center justify-center">
                    <div className="bg-[#000] flex justify-center items-center flex-col gap-2 text-[#E4E4E4] absolute bottom-0 h-[60%] w-full border rounded-b-none border-[#111] p-8 rounded-[24px]">
                        <div className="flex flex-col py-2 w-[300px]">
                        <h2 className="text-2xl font-bold mb-4">Create a new app</h2>
                        {error && <p className="text-red-500 hidden mb-2">{error}</p>}
                        <input
                            type="text"
                            placeholder="App name"
                            value={appName}
                            onChange={(e) => setAppName(e.target.value)}
                            className="w-full p-2 border border-[#222] bg-[#0A0A0A] rounded-[12px] mb-4"
                        />
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleCloseModal}
                                className="bg-[#111] absolute top-4 left-6 text-gray-700 p-1 h-[35px] w-[35px] flex items-center justify-center rounded-full mr-2"
                            >
                                <X color='#E4E4E4'></X>
                            </button>
                            <button
                                onClick={handleCreateApp}
                                className="bg-white text-[#000] font-semibold w-[300px] py-2 px-4 rounded-[25px]"
                            >
                                Create
                            </button>
                            <div className="absolute not-md:overflow-x-auto bottom-4 md:w-[700px] flex f justify-center">
                                <div className="md:w-auto w-full not-md:overflow-x-auto flex md:ml-100 items-center justify-center gap-5">
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/ChatGPT logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/Netflix logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/Spotify logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/Threads logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/Snapchat logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/TikTok logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/Instagram logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/Headspace logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                <div className='h-[50px] w-[50px] rounded-[12px] border border-[#111]'>
                                    <img src="/icons/Uber Eats logo.png" className='h-full w-full object-cover rounded-[12px]' alt="" />
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
        </div>
    );
};

export default Onboard;
