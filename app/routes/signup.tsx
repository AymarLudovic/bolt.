import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Client, Databases } from 'appwrite';
import { useNavigate } from '@remix-run/react';

// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDj0G6ztVSPdX2IBxSm_OTn49uOwYGoQ60",
    authDomain: "gloopin-374f1.firebaseapp.com",
    databaseURL: "https://gloopin-374f1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gloopin-374f1",
    storageBucket: "gloopin-374f1.firebasestorage.app",
    messagingSenderId: "717792072207",
    appId: "1:717792072207:web:a5369e110ab3daad94497a",
    measurementId: "G-K5GHCYGF3E"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialiser Appwrite
const client = new Client();
client.setEndpoint('https://cloud.appwrite.io/v1').setProject('679d739b000950dfb1e0');

const databases = new Databases(client);

const SignupPage: React.FC = () => {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isLoginMode, setIsLoginMode] = useState<boolean>(false);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            let userCredential;
            if (isLoginMode) {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            }
            const userId = userCredential.user.uid;

            // Stocker l'ID utilisateur dans localStorage
            localStorage.setItem('userId', userId);

            if (!isLoginMode) {
                // Calculer les dates pour l'essai gratuit de 2 minutes
                const startDate = new Date();
                const expirationDate = new Date(startDate.getTime() + 2 * 60 * 1000); // Ajoute 2 minutes

                // Créer un abonnement dans Appwrite
                const subscriptionData = {
                    userId: userId,
                    startDate: startDate.toISOString(),
                    expirationDate: expirationDate.toISOString(),
                    isTrial: 'true', // Marquer comme essai gratuit
                    subscriptionType: 'trial' // Indiquer le type d'abonnement
                };

                await databases.createDocument('Boodupy-database-2025', 'subscriptions-200900', userId, subscriptionData);
            }

            navigate('/onboard'); // Redirection après l'inscription
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Définir les images pour les colonnes. Chaque tableau doit avoir au moins 5 images
    // pour que l'effet infini soit fluide. Je les répète pour atteindre ce nombre.
    const imagePaths = [
        "/screens/Rarible iOS .png",
        "/screens/ChatGPT iOS .png",
        "/screens/Nike iOS .png",
        // Répète pour assurer au moins 5 éléments distincts visuellement pour une boucle fluide
        "/screens/Rarible iOS .png",
        "/screens/ChatGPT iOS .png",
        "/screens/Nike iOS .png",
        "/screens/Rarible iOS .png",
        "/screens/ChatGPT iOS .png",
    ];

    // Composant helper pour générer une colonne d'images animées
    const SlidingImageColumn = ({ images, animationDuration, animationDirection, delay = 0, className = '' }: { images: string[], animationDuration: string, animationDirection: 'normal' | 'reverse', delay?: number, className?: string }) => {
        // Duplique le jeu d'images une fois pour créer l'effet de défilement infini
        const combinedImages = [...images, ...images];

        return (
            // Conteneur de la colonne, gère la largeur et l'overflow
            <div className={`relative w-[320px] h-full overflow-hidden rounded-[30px] ${className}`}>
                {/* Conteneur interne qui est animé pour le défilement */}
                <div
                    className="slider-content flex flex-col gap-y-8" // empile verticalement avec un espacement
                    style={{
                        animationDuration: animationDuration,
                        animationDirection: animationDirection,
                        animationDelay: `${delay}s`,
                        // animation-name, timing-function, iteration-count sont définis dans le bloc <style>
                    }}
                >
                    {combinedImages.map((src, imgIdx) => (
                        <div key={`${imgIdx}`} className="w-full bg-white h-[550px] border border-[#eee] rounded-[30px] shrink-0">
                            <img src={src} className="h-full w-full rounded-[30px] object-contain" alt={`Screen ${imgIdx}`} />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row items-center md:justify-between h-[100vh] overflow-hidden" style={{ fontFamily: 'Funnel Display' }}>
            {/* Styles pour les animations des sliders obliques */}
            <style>
                {`
                /* Variables CSS pour le calcul des animations */
                :root {
                    --image-card-height: 550px; /* from h-[550px] on image card */
                    --gap-between-cards: 32px; /* gap-y-8 in Tailwind is 2rem = 32px */
                    --num-display-cards-in-set: ${imagePaths.length}; /* Number of images in one logical set before duplication */
                    
                    /* Total height to scroll for one full seamless loop: (num_cards * card_height) + (num_cards - 1 * gap) */
                    --scroll-distance-y: calc(var(--num-display-cards-in-set) * var(--image-card-height) + (var(--num-display-cards-in-set) - 1) * var(--gap-between-cards));
                    --oblique-offset-x: 80px; /* Adjust this value for more/less horizontal slant */
                }

                /* Keyframes pour le défilement oblique */
                /* L'animation va de (0,0) à (-hauteur_du_set, offset_oblique_X) */
                /* La propriété animation-direction gérera le sens réel */
                @keyframes oblique-slide-vertical {
                    from {
                        transform: translateY(0) translateX(0);
                    }
                    to {
                        transform: translateY(calc(-1 * var(--scroll-distance-y))) translateX(var(--oblique-offset-x));
                    }
                }
                
                /* Styles de base pour les conteneurs d'animation */
                .slider-content {
                    animation-name: oblique-slide-vertical;
                    animation-timing-function: linear;
                    animation-iteration-count: infinite;
                    /* Maintient l'élément à sa position initiale pour éviter un saut au début */
                    transform: translateY(0) translateX(0); 
                }
                `}
            </style>

            <style>
            {`
            /* Keyframes pour le premier slider (ScreenCellMarquee) */
            @keyframes screen-marquee {
                0% {
                    transform: translateX(0);
                }
                100% {
                    /* Déplace le conteneur sur la largeur d'un ensemble complet de 'count' éléments, plus leurs espaces */
                    transform: translateX(calc(-1 * (var(--screen-width) + var(--gap)) * var(--count)));
                }
            }

            /* Applique l'animation à la classe spécifique du premier slider */
            .ScreenCellMarquee_animation_screen_marquee__ff5gz {
                animation: screen-marquee var(--animation-duration) linear infinite;
            }

            /* Keyframes pour le second slider (AppsMarquee / Ticker) */
            @keyframes ticker-slide {
                to {
                    /* Déplace l'élément de 50% de sa propre largeur pour un défilement infini quand le contenu est dupliqué */
                    transform: translateX(-50%);
                }
            }

            /* Applique l'animation au "Ticker" */
            .Ticker_ticker___U0iN {
                animation-name: ticker-slide;
                animation-timing-function: linear;
                animation-iteration-count: infinite;
            }
            `}
        </style>

            {/* Section du slider d'images (cachée sur mobile, visible sur md+) */}
            {/* Ajout de `hidden md:block` pour masquer complètement sur mobile */}
            

            <div className="w-full md:w-[60%] min-w-0 pt-40 min-720:pt-64 min-1280:pt-80 relative hidden md:block">
            <div
                className="flex w-full flex-col gap-y-16 overflow-hidden min-720:gap-y-24"
                data-sentry-component="AppsMarquee"
                data-sentry-source-file="AppsMarquee.tsx">

                {/* Première ligne de Ticker (direction normale) */}
                <div
                    className="relative flex w-full overflow-hidden"
                    data-sentry-component="Ticker"
                    data-sentry-source-file="Ticker.tsx">
                    <div
                        className="Ticker_ticker___U0iN flex shrink-0 overflow-hidden"
                        style={{
                            animationDirection: "normal",
                            animationDuration: "80s", // Ajuste la durée si nécessaire
                        }}>
                        {/* Duplique le contenu pour l'effet infini */}
                        <div className="flex gap-x-24 pr-24 min-720:gap-x-40 min-720:pr-40">
                            <div className="flex items-center gap-2">
                                <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Spotify logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Spotify logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Spotify</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Apple TV.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Apple TV</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Twitch.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Twitch</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/TikTok logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">TikTok</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Duolingo logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Duolingo</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Dropbox.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Dropbox</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px] border border-[#FAFAFA]" src="/icons/ChatGPT logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">ChatGPT</p>
                            </div>
                        </div>
                        {/* Répétition du contenu */}
                        <div className="flex gap-x-24 pr-24 min-720:gap-x-40 min-720:pr-40">
                            <div className="flex items-center gap-2">
                                <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Spotify logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Spotify logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Spotify</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Apple TV.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Apple TV</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Twitch.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Twitch</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/TikTok logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">TikTok</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Duolingo logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Duolingo</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Dropbox.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Dropbox</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px] border border-[#FAFAFA]" src="/icons/ChatGPT logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">ChatGPT</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Deuxième ligne de Ticker (direction inversée) */}
                <div
                    className="relative flex w-full overflow-hidden"
                    data-sentry-component="Ticker"
                    data-sentry-source-file="Ticker.tsx">
                    <div
                        className="Ticker_ticker___U0iN flex shrink-0 overflow-hidden"
                        style={{
                            animationDirection: "reverse", // Ici l'animation sera inversée
                            animationDuration: "80s", // Ajuste la durée si nécessaire
                        }}>
                        {/* Duplique le contenu pour l'effet infini */}
                        <div className="flex gap-x-24 pr-24 min-720:gap-x-40 min-720:pr-40">
                            <div className="flex items-center gap-2">
                                <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Spotify logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Spotify logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Spotify</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Apple TV.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Apple TV</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Twitch.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Twitch</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/TikTok logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">TikTok</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Duolingo logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Duolingo</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Dropbox.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Dropbox</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px] border border-[#FAFAFA]" src="/icons/ChatGPT logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">ChatGPT</p>
                            </div>
                        </div>
                        {/* Répétition du contenu */}
                        <div className="flex gap-x-24 pr-24 min-720:gap-x-40 min-720:pr-40">
                            <div className="flex items-center gap-2">
                                <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Spotify logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Spotify logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Spotify</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Apple TV.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Apple TV</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Twitch.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Twitch</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/TikTok logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">TikTok</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Duolingo logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Duolingo</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Dropbox.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Dropbox</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px] border border-[#FAFAFA]" src="/icons/ChatGPT logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">ChatGPT</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Troisième ligne de Ticker (direction normale) */}
                <div
                    className="relative flex w-full overflow-hidden"
                    data-sentry-component="Ticker"
                    data-sentry-source-file="Ticker.tsx">
                    <div
                        className="Ticker_ticker___U0iN flex shrink-0 overflow-hidden"
                        style={{
                            animationDirection: "normal",
                            animationDuration: "80s", // Ajuste la durée si nécessaire
                        }}>
                        {/* Duplique le contenu pour l'effet infini */}
                        <div className="flex gap-x-24 pr-24 min-720:gap-x-40 min-720:pr-40">
                            <div className="flex items-center gap-2">
                                <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Spotify logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Spotify logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Spotify</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Apple TV.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Apple TV</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Twitch.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Twitch</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/TikTok logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">TikTok</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Duolingo logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Duolingo</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px]" src="/icons/Dropbox.webp" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">Dropbox</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <div className="relative shrink-0 overflow-hidden after:absolute after:inset-0 after:rounded-[inherit] after:shadow-logo-inset  rounded-12 ">
                                    <img alt="Apple TV logo" className="size-full object-cover h-[100px] w-[100px] rounded-[25px] border border-[#FAFAFA]" src="/icons/ChatGPT logo.png" />
                                </div>
                                <p className="text-nowrap font-semibold text-4xl min-720:text-title-2">ChatGPT</p>
                            </div>
                        </div>


                        
                        {/* Répétition du contenu */}
                        
                    </div>
                </div>

            </div>
        </div>

            {/* Section du formulaire de connexion/inscription (visible sur mobile, adaptée sur desktop) */}
            <div className="bg-white w-full md:w-[40%] h-full flex flex-col items-center justify-center p-8 rounded-lg md:overflow-y-auto">
                <div className="flex items-center justify-center lg:w-[80%] w-[90%] h-full flex-col gap-2">
                    <div className='w-full flex flex-col gap-1'>
                        <h2 className="text-3xl font-bold md:text-5xl">{isLoginMode ? 'Log in to your account' : 'Create an account'}</h2>
                        {error && <p className="text-red-500 mb-4">{error}</p>}
                        <h2 className="text-[#888] md:text-2xl mb-4 font-semibold">{isLoginMode ? 'Think it, Build It.' : 'Build your apps in seconds'}</h2>
                    </div>
                    <form onSubmit={handleAuth} className="w-full">
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full  p-2 border bg-[#fafafa] border-[#EEE] rounded-[6px] mb-4"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full p-2 border bg-[#fafafa] border-[#EEE] rounded-[6px] mb-4"
                        />
                        <button type="submit" className="w-full bg-black text-[#E4E4E4] text-sm py-3 px-4 rounded-[25px]">
                            {isLoginMode ? 'Log In' : 'Sign Up'}
                        </button>
                    </form>
                    <p className="text-center mt-4">
                        {isLoginMode ? 'Not account yet ? ' : 'Already have an account ? '}
                        <button
                            onClick={() => setIsLoginMode(!isLoginMode)}
                            className="text-[#888] underline"
                        >
                            {isLoginMode ? 'Sign Up' : 'Log In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
