import { useState, useEffect } from 'react';
import { Plus, LogOut, Globe, X, User2, CreditCard, } from 'lucide-react';
import { Client, Databases, ID, Query } from 'appwrite';
import { formatDistanceToNow } from 'date-fns';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useNavigate } from '@remix-run/react';
import { SiHeadspace } from 'react-icons/si';
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
    const [showPlanContainer, setShowPlanContainer] = useState<boolean>(false);
    const navigate = useNavigate();

    const databaseId = 'Boodupy-database-2025';
    const collectionId = 'apps-200900';
    const discountCouponCollectionId = 'discounts-coupon-200900';

    const [discountCode, setDiscountCode] = useState('');
    const ORIGINAL_PRICE = 10.00;
    const [discountedPrice, setDiscountedPrice] = useState<number>(ORIGINAL_PRICE);
    const [appliedDiscountInfo, setAppliedDiscountInfo] = useState<any | null>(null);
    const [discountMessage, setDiscountMessage] = useState<string>('');

    const handleCloseContainer = () => {
        setShowPlanContainer(false);
        setDiscountCode('');
        setDiscountMessage('');
        setDiscountedPrice(ORIGINAL_PRICE);
        setAppliedDiscountInfo(null);
    };

    const handleApplyDiscount = async () => {
        if (!discountCode.trim()) {
            setDiscountMessage("Veuillez entrer un code de réduction.");
            if (appliedDiscountInfo) {
                setDiscountedPrice(ORIGINAL_PRICE);
                setAppliedDiscountInfo(null);
            }
            return;
        }
        setDiscountMessage("Checking discount validity...");
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

    const checkSubscriptionValidity = (subscriptionData: any) => { // Renommé pour clarté
        if (subscriptionData && subscriptionData.expirationDate) {
            const expirationDate = new Date(subscriptionData.expirationDate);
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

    const fetchSubscription = async (currentUserId: string) => { // Renommé pour clarté
        try {
            const response = await databases.listDocuments(
                'Boodupy-database-2025',
                'subscriptions-200900',
                [Query.equal('userId', currentUserId),Query.equal('$id', currentUserId),]
                
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

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            setUserId(storedUserId);
            fetchSubscription(storedUserId);
        } else {
            navigate('/signup');
        }
        // Pour tester PlanContainer, vous pouvez le faire s'ouvrir via un bouton ou une condition
        // Par exemple, vous pourriez avoir un bouton dans votre UI qui appelle:
        // const openPlanModal = () => setShowPlanContainer(true);
    }, [navigate]);
    
    // Fonctions non utilisées dans le JSX minimal fourni mais potentiellement utiles
    const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);
    const showSubscriptionDetails = () => { setShowPlanContainer(true); setIsUserMenuOpen(false); };
    const fetchUserApps = async (currentUserId: string) => { /* ... */ };
    const handleCreateAppClick = () => { setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setAppName(''); setError(''); };
    const handleCreateApp = async () => { /* ... */ };
    const handleLogout = () => { /* ... */ };


    const PlanContainer = ({
        userId: propUserId, // Renommé pour éviter la confusion avec l'état userId de Onboard dans cette portée
        subscription: propSubscription, // Renommé
        fetchSubscription: propFetchSubscription, // Renommé
        isSubscriptionValid: propIsSubscriptionValid, // Renommé
        setShowPlanContainer: propSetShowPlanContainer, // Renommé
        timeLeftString,
        className
    }: {
        userId: string | null;
        subscription: any;
        fetchSubscription: (userId: string) => Promise<void>,
        isSubscriptionValid: boolean,
        setShowPlanContainer: React.Dispatch<React.SetStateAction<boolean>>
        timeLeftString: string
        className: string
    }) => {
        // Les états `discountCode`, `discountedPrice`, `discountMessage`, `appliedDiscountInfo`
        // et les fonctions `handleApplyDiscount`, `handleCloseContainer`
        // sont accessibles directement depuis le scope de `Onboard`

        const initialOptions = {
            clientId: "AVrI1_PndcFEeGuj8PH9qyOQofIy0_MaSNaOZwstDJQZWW6bhc-CRnEcpAqi6fzonlA2pjo-9W-bBG5H",
            currency: "USD",
            intent: "capture",
        };

        // CORRIGÉ : updateSubscription
        const updateSubscription = async (userIdToUpdate: string) => {
            // L'ID du document d'abonnement est propSubscription.$id
            if (!propSubscription || !propSubscription.$id) {
                console.error('Impossible de mettre à jour l\'abonnement : propSubscription.$id manquant.');
                setError("Erreur: ID d'abonnement manquant pour la mise à jour.");
                return;
            }

            try {
                console.log('subscription', subscription.$id )
                const newExpirationDate = new Date();
                newExpirationDate.setDate(newExpirationDate.getDate() + 30);
                const updateData = {
                    subscriptionType: 'plan',
                    expirationDate: newExpirationDate.toISOString()
                };

                await databases.updateDocument(
                    'Boodupy-database-2025',      // databaseId
                    'subscriptions-200900',      // collectionId
                    subscription.$id,        // documentId (ID de l'abonnement)
                    updateData                   // data
                );
                console.log('Abonnement mis à jour avec succès dans Appwrite.');
                propFetchSubscription(userIdToUpdate); // Rafraîchir l'abonnement de l'utilisateur
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'abonnement dans Appwrite :', error);
                setError("Erreur lors de la mise à jour de l'abonnement.");
            }
        };

        return (
            <div className={`fixed bottom-0  h-full left-0 right-0 z-[9999] w-full ${className}`}>
                <div className='fixed top-12 left-[12%] lg:left-[48%]'>
                    <div className="flex items-center gap-1">
                    <SiHeadspace size={18}></SiHeadspace>
                    <span className='font-semibold text-3xl'>Studio</span>
                    </div>
                </div>
                <div className="absolute  flex-col  overflow-y-auto md:flex-row lg:flex-row bottom-0 bg-white h-[80%] md:h-[60%] lg:h-[60%] rounded-t-[15px] p-2 w-full lg:border-t flex items-center justify-center gap-3 border-[#EEE]">
                   
                    
                    {/* Colonne Infos Plan */}
                    <div className='h-[90%]  flex flex-col gap-2 p-3 w-[90%] lg:w-[40%] md:w-[40%] border border-[#EEE] rounded-[20px]'>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl md:text-3xl">Pro</h2>
                            <div className="py-1 px-2 rounded-[12px] select-none text-white bg-blue-600 text-xs md:text-sm h-[26px] md:h-[30px] flex items-center justify-center">upgrade</div>
                        </div>
                        <div className="flex items-baseline gap-2"> {/* items-baseline pour aligner prix et /month */}
                            <h2 className="text-4xl md:text-5xl font-semibold">
                                ${discountedPrice.toFixed(2)}
                            </h2>
                            {discountedPrice < ORIGINAL_PRICE && (
                                <span className="text-lg md:text-xl line-through text-gray-500">${ORIGINAL_PRICE.toFixed(2)}</span>
                            )}
                            <p className='font-medium text-sm md:text-base'>/month</p>
                        </div>
                        <ul className="flex flex-col gap-1 text-sm md:text-base">
                            <li className='flex items-center gap-x-2 py-1'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 h-[20px] w-[20px]"><path d="M10 11V15" stroke="currentColor" strokeWidth="1.5"></path><path d="M16 8H4V15L7 18H13L16 15V8Z" stroke="currentColor" strokeWidth="1.5"></path><path d="M7 8V4C7 2.34315 8.34315 1 10 1V1C11.6569 1 13 2.34315 13 4V4.5" stroke="currentColor" strokeWidth="1.5"></path></svg>
                                <p className="font-medium">Build unlimited apps and websites</p>
                            </li>
                            <li className='flex items-center gap-x-2 py-1'>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 h-[20px] w-[20px]"><title>flow icon</title><path d="M4 17C5.65685 17 7 15.6569 7 14C7 12.3431 5.65685 11 4 11C2.34315 11 1 14C1 15.6569 2.34315 17 4 17Z" fill="currentColor"></path><path d="M13 3H16H19V6V9H16H13V6V3Z" fill="currentColor"></path><path d="M4 9V7C4 5.34315 5.34315 4 7 4C8.65685 4 10 5.34315 10 7V13C10 14.6569 11.3431 16 13 16C14.6569 16 16 14.6569 16 13V11" stroke="currentColor" strokeWidth="1.5"></path></svg>
                                <p className="font-medium">No messages or tokens limits</p>
                            </li>
                            <li className='flex items-center gap-x-2 py-1'>
                                <Globe size={20} className="shrink-0"/>
                                <p className="font-medium">Fast deploy online.</p>
                            </li>
                        </ul>
                        <div className="mt-auto"> {/* Pousse PayPal en bas */}
                            {isSubscriptionValid ? (
                                <button style={{ border: "1px solid #eee" }} className="w-full h-[40px] md:h-[48px] max-w-[300px] opacity-[0.6] pointer-events-none rounded-[15px] bg-white flex items-center justify-center text-sm md:text-base">Subscribed (renews {timeLeftString})</button>
                            ) : (
                                propUserId && (
                                    <PayPalScriptProvider options={initialOptions}>
                                        <PayPalButtons
                                            style={{ layout: "vertical", height: 48 }}
                                            createOrder={(data, actions) => {
                                                return actions.order.create({
                                                    intent: 'CAPTURE',
                                                    purchase_units: [{
                                                        amount: {
                                                            currency_code: "USD",
                                                            value: discountedPrice.toFixed(2),
                                                        },
                                                    }],
                                                });
                                            }}
                                            onApprove={async (data, actions) => {
                                                const details = await actions.order?.capture();
                                                if (details) {
                                                    alert("Transaction completed by " + details.payer?.name?.given_name);
                                                    if (propUserId) {
                                                        updateSubscription(propUserId);
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
                                )
                            )}
                        </div>
                    </div>

                    {/* Colonne Code Promo */}
                    <div className='h-[90%]  flex flex-col gap-2 p-3 w-[90%] lg:w-[40%] md:w-[40%] border border-[#EEE] rounded-[20px]'>
                        <h1 className="text-2xl md:text-3xl font-semibold">Apply Discount.</h1>
                        <p className="text-sm md:text-base text-[#888]">Apply a discount code to reduce the amount for your next billing cycle.</p>
                        <div>
                            <input
                                type="text"
                                placeholder="Discount Code"
                                value={discountCode}
                                onChange={(e) => setDiscountCode(e.target.value)}
                                className="w-full px-3 py-3 bg-white border-2 border-[#EEE] placeholder:text-gray-500 focus-visible:border-blue-500 rounded-[12px] text-sm md:text-base mb-2"
                                disabled={propIsSubscriptionValid}
                            />
                        </div>
                        {discountMessage && (
                            <p className={`text-xs md:text-sm mb-2 ${appliedDiscountInfo ? 'text-green-600' : 'text-[#888]'}`}>
                                {discountMessage}
                            </p>
                        )}
                        <button
                            onClick={handleApplyDiscount}
                            className={`w-full h-[40px] md:h-[48px] max-w-[300px] text-white rounded-[12px] bg-black flex items-center justify-center text-sm md:text-base ${propIsSubscriptionValid ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
                            disabled={propIsSubscriptionValid}
                        >
                            Apply Code
                        </button>
                    </div>
                </div>
                <UpgradeTimer timeRemaining={timeRemaining} isSubscriptionValid={isSubscriptionValid} />
            </div>
        )
    }

    const UpgradeTimer = ({ timeRemaining, isSubscriptionValid }: { timeRemaining: number | null, isSubscriptionValid: boolean }) => {
        if (!isSubscriptionValid || timeRemaining === null || timeRemaining <= 0) {
            return null;
        }
        const timeLeftString = formatDistanceToNow(new Date(Date.now() + timeRemaining), { addSuffix: true });
        const totalTime = 30 * 24 * 60 * 60 * 1000; 
        const timeElapsed = totalTime - timeRemaining;
        const progress = Math.min(1, timeElapsed / totalTime); 
        return (
            <div className='fixed bottom-5 right-4 p-4 h-auto flex flex-col gap-2 w-[260px] border border-[#EEE] rounded-[15px] bg-white shadow-md'>
                <div><p className="font-semibold text-sm"><span className="text-sm">🚀</span> Your trial ends {timeLeftString}</p></div>
                <div className="flex gap-1 justify-center w-full items-center">
                    {[...Array(4)].map((_, index) => {
                        const barProgress = Math.min(1, Math.max(0, progress * 4 - index));
                        return (<div key={index} className="h-[5px] flex-1 rounded-[8px] bg-[#EEE] overflow-hidden">
                                <div className={`h-full bg-black transition-all duration-300 ease-out`} style={{ width: `${barProgress * 100}%` }} />
                            </div>);
                    })}
                </div>
                {isSubscriptionValid && <button onClick={() => setShowPlanContainer(true)} className="h-[30px] w-full opacity-[0.6] sr-only pointer-events-none select-none text-xs text-white rounded-lg bg-black flex items-center justify-center py-4 px-4 mt-1">Upgraded to pro</button>}
            </div>
        );
    };

    const timeLeftString = timeRemaining !== null ? formatDistanceToNow(new Date(Date.now() + timeRemaining), { addSuffix: true }) : "";

    return (
        <div className='h-screen w-full text-black overflow-y-auto' style={{ fontFamily: 'Funnel Display' }} >
            {/* Exemple de bouton pour ouvrir PlanContainer */}
            <PlanContainer
                    userId={userId}
                    subscription={subscription}
                    fetchSubscription={fetchSubscription}
                    isSubscriptionValid={isSubscriptionValid}
                    setShowPlanContainer={setShowPlanContainer}
                    timeLeftString={timeLeftString}
                    className='' // La classe 'hidden' sera gérée par le rendu conditionnel
                />
             
        </div>
    );
};

export default Onboard;
