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
const signup = () => {
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
                const expirationDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);


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

  return (
    <div style={{fontFamily:'Funnel Display'}} className="bg-white w-full md:w-[40%] h-full flex flex-col items-center justify-center p-8 rounded-lg md:overflow-y-auto">
                <div className="flex items-center justify-center w-[70%] h-full flex-col gap-2">
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
                            className="w-full p-2 border bg-[#fafafa] border-[#EEE] rounded-[6px] mb-4"
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
  )
}

export default signup
