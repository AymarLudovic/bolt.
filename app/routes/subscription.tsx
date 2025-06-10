import { useState, useEffect } from 'react';
import { Plus, LogOut, Globe, X, User2, CreditCard, } from 'lucide-react';
import { Client, Databases, ID, Query } from 'appwrite';
import { formatDistanceToNow } from 'date-fns';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useNavigate } from '@remix-run/react';

// Initialiser Appwrite
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
    const [showPlanContainer, setShowPlanContainer] = useState<boolean>(false); // Mettez à true pour tester directement PlanContainer
    const navigate = useNavigate();

    const databaseId = 'Boodupy-database-2025';
    const collectionId = 'apps-200900';
    const discountCouponCollectionId = 'discounts-coupon-200900';

    const [discountCode, setDiscountCode] = useState(''); // État de Onboard pour le code
    const ORIGINAL_PRICE = 10.00;
    const [discountedPrice, setDiscountedPrice] = useState<number>(ORIGINAL_PRICE); // État de Onboard pour le prix réduit
    const [appliedDiscountInfo, setAppliedDiscountInfo] = useState<any | null>(null);
    const [discountMessage, setDiscountMessage] = useState<string>(''); // État de Onboard pour le message

    // Fonction de Onboard pour fermer ET réinitialiser
    const handleCloseContainer = () => {
        setShowPlanContainer(false);
        setDiscountCode('');
        setDiscountMessage('');
        setDiscountedPrice(ORIGINAL_PRICE);
        setAppliedDiscountInfo(null);
    };

    // Fonction de Onboard pour appliquer la réduction
    const handleApplyDiscount = async () => {
        if (!discountCode.trim()) {
            setDiscountMessage("Veuillez entrer un code de réduction.");
            if (appliedDiscountInfo) {
                setDiscountedPrice(ORIGINAL_PRICE);
                setAppliedDiscountInfo(null);
            }
            return;
        }
        setDiscountMessage("Vérification du code...");
        try {
            const response = await databases.listDocuments(
                databaseId,
                discountCouponCollectionId,
                [Query.equal('code', discountCode.trim().toUpperCase())]
            );
            if (response.documents.length > 0) {
                const promo = response.documents[0];
                const expirationDate = new Date(promo.Expiration);
                const now = new Date();
                if (expirationDate < now) {
                    setDiscountMessage("Ce code de réduction a expiré.");
                    setDiscountedPrice(ORIGINAL_PRICE);
                    setAppliedDiscountInfo(null);
                } else {
                    const reductionPercentage = parseFloat(promo.reduce);
                    if (isNaN(reductionPercentage) || reductionPercentage <= 0 || reductionPercentage > 100) {
                        setDiscountMessage("Code de réduction invalide (valeur de réduction incorrecte).");
                        setDiscountedPrice(ORIGINAL_PRICE);
                        setAppliedDiscountInfo(null);
                        return;
                    }
                    const newPrice = ORIGINAL_PRICE - (ORIGINAL_PRICE * (reductionPercentage / 100));
                    setDiscountedPrice(Math.max(0.01, newPrice));
                    setAppliedDiscountInfo(promo);
                    // MODIFIÉ : Message plus clair avec le nouveau prix
                    setDiscountMessage(`Discount "${promo.code}" applied ! Reduction of ${reductionPercentage}%. New price : $${newPrice.toFixed(2)}`);
                }
            } else {
                setDiscountMessage("Discount code not found or avalaible");
                setDiscountedPrice(ORIGINAL_PRICE);
                setAppliedDiscountInfo(null);
            }
        } catch (error) {
            console.error("Erreur lors de la vérification du code de réduction :", error);
            setDiscountMessage("Erreur serveur lors de l'application du code.");
            setDiscountedPrice(ORIGINAL_PRICE);
            setAppliedDiscountInfo(null);
        }
    };

    // ... (reste des fonctions de Onboard: checkSubscriptionValidity, fetchSubscription, etc. restent inchangées)
    const checkSubscriptionValidity = (subscription: any) => {
        if (subscription && subscription.expirationDate) {
            const expirationDate = new Date(subscription.expirationDate);
            const now = new Date();
    
            if (expirationDate > now) {
                setIsSubscriptionValid(true); 
                const timeLeft = expirationDate.getTime() - now.getTime();
                setTimeRemaining(timeLeft); 
            } else {
                setIsSubscriptionValid(false); 
                setTimeRemaining(0); 
            }
        } else {
            setIsSubscriptionValid(false); 
            setTimeRemaining(0); 
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
                checkSubscriptionValidity(subscriptionData);
            } else {
                setSubscription(null);
                setIsSubscriptionValid(false); 
            }
    
        } catch (error) {
            console.error("Erreur lors de la récupération de l'abonnement :", error);
            setError("Erreur lors du chargement de l'abonnement.");
            setSubscription(null); 
            setIsSubscriptionValid(false); 
        }
    };

    const toggleUserMenu = () => {
        setIsUserMenuOpen(!isUserMenuOpen);
    };

    const showSubscriptionDetails = () => {
        setShowPlanContainer(true); 
        setIsUserMenuOpen(false);   
    };

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setUserId(storedUserId);
            // fetchUserApps(storedUserId); // Vous pouvez décommenter si nécessaire
            fetchSubscription(storedUserId); 
        } else {
            navigate('/signup');
        }
        // Pour tester PlanContainer directement :
        // setShowPlanContainer(true); // Décommentez pour voir PlanContainer au chargement
    }, [navigate]); 

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
    const handleCreateAppClick = () => { setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setAppName(''); setError(''); };
    const handleCreateApp = async () => { /* ... */ };
    const handleLogout = () => { /* ... */ };
    


    const PlanContainer = ({ userId, subscription, fetchSubscription, isSubscriptionValid, setShowPlanContainer, timeLeftString, className }: {
        userId: string | null;
        subscription: any;
        fetchSubscription: (userId: string) => Promise<void>,
        isSubscriptionValid: boolean,
        setShowPlanContainer: React.Dispatch<React.SetStateAction<boolean>>
        timeLeftString: string
        className: string
    }) => {
        const [sdkReady, setSdkReady] = useState(false);
        // const [discountCode, setDiscountCode] = useState(''); // SUPPRIMÉ - On utilise celui de Onboard

        // SUPPRIMÉ - La fonction locale handleCloseContainer n'est plus nécessaire si le bouton X appelle celle de Onboard
        // const handleCloseContainer = () => {
        //     setShowPlanContainer(false); 
        // }

        // SUPPRIMÉ - La fonction locale handleAppyDiscount n'est plus nécessaire
        // const handleAppyDiscount = () => {
        // }

        const initialOptions = {
            clientId: "AfUVt7FlKnS-R6INQXaNCKVgZM2VrHj6r9-gP2vG_bg-PrgJ5olkVJfeoP6NZW5w3bn4oHLf8EsRVqze",
            currency: "USD",
            intent: "capture",
        };

        const updateSubscription = async (userIdToUpdate: string) => { // Renommé userId pour éviter conflit avec prop
            try {
                const newExpirationDate = new Date();
                newExpirationDate.setDate(newExpirationDate.getDate() + 30);
                const updateData = {
                    subscriptionType: 'plan',
                    expirationDate: newExpirationDate.toISOString()
                };
                if (subscription && subscription.$id) { // Vérifie que subscription et son ID existent
                    await databases.updateDocument('Boodupy-database-2025', 'subscriptions-200900', subscription.$id, updateData);
                    console.log('Abonnement mis à jour avec succès dans Appwrite.');
                    fetchSubscription(userIdToUpdate);
                } else {
                    console.error('Impossible de mettre à jour l\'abonnement : subscription.$id manquant.');
                    setError("Erreur: ID d'abonnement manquant pour la mise à jour.");
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'abonnement dans Appwrite :', error);
                setError("Erreur lors de la mise à jour de l'abonnement.");
            }
        };

        return (
            <div className={`fixed bottom-0 h-full left-0 right-0 z-[9999] w-full ${className}`}>
                <div className="absolute flex-col overflow-y-auto md:flex-row lg:flex-row bottom-0 bg-white h-[80%] md:h-[60%] lg:h-[60%] rounded-t-[15px] p-2 w-full border-t flex items-center justify-center gap-3 border-[#EEE]">
                    <button
                        onClick={handleCloseContainer} // MODIFIÉ : Appelle handleCloseContainer de Onboard
                        style={{ border: "1px solid #EEE" }}
                        // MODIFIÉ : Retiré sr-only conditionnel, la visibilité est gérée par showPlanContainer
                        className={`bg-[#FAFAFA] absolute top-4 left-6 text-gray-700 p-1 h-[35px] w-[35px] flex items-center justify-center rounded-full mr-2`}
                    >
                        <X color='#888'></X>
                    </button>
                    <div className='h-[90%] flex flex-col gap-2 p-3 w-[90%] lg:w-[40%] md:w-[40%] border border-[#EEE] rounded-[20px]'>
                        <div className="flex items-center gap-2">
                            <h2 className=" text-3xl">Pro</h2>
                            <div className="py-1 px-2 rounded-[12px] select-none text-white bg-blue-600 text-sm h-[30px] flex items-center justify-center">upgrade</div>
                        </div>
                        {/* MODIFIÉ : Affichage du prix dynamique */}
                        <div className="flex items-center gap-2">
                            <h2 className="text-5xl font-semibold">
                                ${discountedPrice.toFixed(2)}
                            </h2>
                            {discountedPrice < ORIGINAL_PRICE && (
                                <span className="text-xl line-through text-gray-500">${ORIGINAL_PRICE.toFixed(2)}</span>
                            )}
                            <p className='font-medium'>/month</p>
                        </div>
                        <ul className="flex flex-col">
                            {/* ... vos li items ... */}
                            <li className='flex text-compact gap-x-2 py-2 items-center gap-[2px]'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="pointer-events-none size-20 shrink-2 h-[24px] w-[24px]" data-sentry-element="svg" data-sentry-component="UnlockedIcon" data-sentry-source-file="UnlockedIcon.tsx"><path d="M10 11V15" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" ></path><path d="M16 8H4V15L7 18H13L16 15V8Z" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"></path><path d="M7 8V4C7 2.34315 8.34315 1 10 1V1C11.6569 1 13 2.34315 13 4V4.5" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"></path></svg>
                                <p className="font-semibold relative top-[1px] ">Build unlimited apps and websites</p>
                            </li>
                            <li className='flex text-compact gap-x-2 py-2 items-center gap-[2px]'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="pointer-events-none size-20 shrink-2 h-[24px] w-[24px]" data-sentry-element="svg" data-sentry-component="FlowIcon" data-sentry-source-file="FlowIcon.tsx"><title>flow icon</title><path d="M4 17C5.65685 17 7 15.6569 7 14C7 12.3431 5.65685 11 4 11C2.34315 11 1 14C1 15.6569 2.34315 17 4 17Z" fill="currentColor"></path><path d="M13 3H16H19V6V9H16H13V6V3Z" fill="currentColor"></path><path d="M4 9V7C4 5.34315 5.34315 4 7 4C8.65685 4 10 5.34315 10 7V13C10 14.6569 11.3431 16 13 16C14.6569 16 16 14.6569 16 13V11" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" ></path></svg>
                                <p className="font-semibold relative top-[1px] ">No messages or tokens limits</p>
                            </li>
                            <li className='flex text-compact gap-x-2 py-2 items-center gap-[2px]'>
                                <Globe></Globe>
                                <p className="font-semibold relative top-[1px] ">Fast deploy online.</p>
                            </li>
                        </ul>
                        {isSubscriptionValid ? (
                            <button style={{ border: "1px solid #eee" }} className="h-[38px] max-w-[240px] opacity-[0.6] pointer-events-none rounded-[15px] bg-white flex items-center justify-center py-5 px-8">pay soon in {timeLeftString}</button>
                        ) : (
                            userId && <PayPalScriptProvider options={initialOptions}> {/* AJOUTÉ: Vérifie userId avant de rendre PayPal */}
                                <PayPalButtons
                                    style={{ layout: "vertical" }}
                                    createOrder={(data, actions) => {
                                        return actions.order.create({
                                            intent: 'CAPTURE',
                                            purchase_units: [{
                                                amount: {
                                                    currency_code: "USD",
                                                    value: discountedPrice.toFixed(2), // MODIFIÉ
                                                },
                                            }],
                                        });
                                    }}
                                    onApprove={async (data, actions) => {
                                        const details = await actions.order?.capture();
                                        if (details) {
                                            alert("Transaction completed by " + details.payer?.name?.given_name);
                                            if (userId) { // userId est déjà vérifié avant de rendre PayPalButtons
                                                updateSubscription(userId);
                                            }
                                        } else {
                                            console.error("La capture de l'ordre a échoué.");
                                            setError("La transaction PayPal a échoué.");
                                        }
                                    }}
                                    onError={(err) => {
                                        console.error("PayPal Error:", err);
                                        setError("Une erreur est survenue avec PayPal. Veuillez réessayer.");
                                    }}
                                />
                            </PayPalScriptProvider>
                        )}
                    </div>
                    <div className='h-[90%] flex flex-col gap-2 p-3 w-[90%] lg:w-[40%] md:w-[40%] border border-[#EEE] rounded-[12px]'>
                        <h1 className="text-4xl font-semibold">Apply Discount.</h1>
                        <p className="font-semibold text-1xl text-[#888]"> Apply a discount code to reduce the amount that you will pay on a billing cycle. Pay less and beneficits of all pro features and accessibilities.</p>
                        
                        {/* Section du code de réduction, toujours affichée si PlanContainer est visible,
                            mais les intéractions sont désactivées si l'abonnement est déjà valide. */}
                        <div>
                            <input
                                type="text"
                                placeholder="Discount Code"
                                value={discountCode} // Utilise discountCode de Onboard
                                onChange={(e) => setDiscountCode(e.target.value)} // Utilise setDiscountCode de Onboard
                                className="w-full px-3 py-3 bg-white border-2 border-[#EEE] placeholder:text-black focus-visible:border-[#888] focus-visible:border-4 rounded-[15px] text-base mb-2"
                                disabled={isSubscriptionValid} // Désactive si abonnement valide
                            />
                        </div>
                        {/* AJOUTÉ : Affichage du message de réduction */}
                        {discountMessage && (
                            <p className={`text-sm mb-2 ${appliedDiscountInfo ? 'text-green-600' : 'text-red-600'}`}>
                                {discountMessage}
                            </p>
                        )}
                        <button
                            onClick={handleApplyDiscount} // MODIFIÉ : Appelle handleApplyDiscount de Onboard
                            className={`h-[48px] max-w-[100%] lg:max-w-[240px] text-white rounded-[25px] bg-black flex items-center justify-center py-5 px-8 ${isSubscriptionValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isSubscriptionValid} // Désactive si abonnement valide
                        >
                            Apply Code
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const UpgradeTimer = ({ timeRemaining, isSubscriptionValid }: { timeRemaining: number | null, isSubscriptionValid: boolean }) => {
        // ... (votre code UpgradeTimer reste inchangé)
        if (!isSubscriptionValid || timeRemaining === null || timeRemaining <= 0) {
            return null;
        }
        const timeLeftString = formatDistanceToNow(new Date(Date.now() + timeRemaining), { addSuffix: true });
        const totalTime = 30 * 24 * 60 * 60 * 1000; 
        const timeElapsed = totalTime - timeRemaining;
        const progress = Math.min(1, timeElapsed / totalTime); 
        return (
            <div className='fixed bottom-5 right-4 p-4 h-auto flex flex-col gap-2 w-[260px] border border-[#EEE] rounded-[15px] bg-white shadow-md'>
                <div><p className="font-semibold"><span className="text-sm">🚀</span> Your trial ends {timeLeftString}</p></div>
                <div className="flex gap-1 justify-center w-full items-center">
                    {[...Array(4)].map((_, index) => {
                        const barProgress = Math.min(1, Math.max(0, progress * 4 - index));
                        return (<div key={index} className="h-[5px] w-full rounded-[8px] bg-[#EEE] overflow-hidden">
                                <div className={`h-full bg-black transition-all duration-300 ease-out`} style={{ width: `${barProgress * 100}%` }} />
                            </div>);
                    })}
                </div>
                {isSubscriptionValid && <button onClick={() => setShowPlanContainer(true)} className="h-[30px] w-auto text-sm text-white rounded-lg bg-black flex items-center justify-center py-4 px-4 mt-1">Upgrade to Pro</button>}
            </div>
        );
    };

    const timeLeftString = timeRemaining !== null ? formatDistanceToNow(new Date(Date.now() + timeRemaining), { addSuffix: true }) : "";

    return (
        <div className='h-screen w-full text-black overflow-hidden' style={{ fontFamily: 'Funnel Display' }} >
            {/* Vous devez avoir un moyen d'ouvrir PlanContainer, par exemple un bouton dans un menu */}
            {/* Pour l'instant, il s'affiche si showPlanContainer est true */}
            <PlanContainer
                    userId={userId}
                    subscription={subscription}
                    fetchSubscription={fetchSubscription}
                    isSubscriptionValid={isSubscriptionValid}
                    setShowPlanContainer={setShowPlanContainer} // setShowPlanContainer est toujours passé pour fermer
                    timeLeftString={timeLeftString}
                    className=''
                />
            
            {/* Le reste de votre UI (header, liste d'apps, etc.) */}
            {/* {!showPlanContainer && ( // Exemple de bouton pour ouvrir PlanContainer si ce n'est pas déjà ouvert
                 <button 
                    onClick={() => setShowPlanContainer(true)}
                    className="fixed bottom-5 left-5 bg-blue-500 text-white p-3 rounded-lg shadow-lg"
                 >
                    Show Subscription Plan
                 </button>
            )} */}
             <UpgradeTimer timeRemaining={timeRemaining} isSubscriptionValid={isSubscriptionValid} />
        </div>
    );
};

export default Onboard;
