/* * APIKeyManager.tsx */
import React, { useState, useEffect, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton'; // Assure-toi que le chemin est correct
import type { ProviderInfo } from '~/types/model'; // Assure-toi que le chemin est correct
import Cookies from 'js-cookie';

interface APIKeyManagerProps {
  provider: ProviderInfo; // Le fournisseur de modèle actuel
  apiKey: string; // La clé API actuelle pour ce fournisseur (vient de BaseChat)
  setApiKey: (key: string) => void; // Fonction pour sauvegarder la clé (en fait onApiKeysChange de BaseChat)
  getApiKeyLink?: string; // Lien optionnel pour obtenir une clé API
  labelForGetApiKey?: string; // Label optionnel pour le bouton "Get API Key"
  onKeyRequiredStatusChange?: (isRequired: boolean, providerName: string) => void; // Callback pour informer BaseChat
}

// Cache pour savoir si une clé est définie via variable d'environnement (pour éviter des appels API répétés)
const providerEnvKeyStatusCache: Record<string, boolean> = {};
// Cache pour la désérialisation des cookies (petite optimisation)
const apiKeyMemoizeCache: { [k: string]: Record<string, string> } = {};

export function getApiKeysFromCookies() {
  const storedApiKeys = Cookies.get('apiKeys');
  let parsedKeys: Record<string, string> = {};
  if (storedApiKeys) {
    parsedKeys = apiKeyMemoizeCache[storedApiKeys];
    if (!parsedKeys) {
      parsedKeys = apiKeyMemoizeCache[storedApiKeys] = JSON.parse(storedApiKeys);
    }
  }
  return parsedKeys;
}

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({
  provider,
  apiKey, // Reçue de BaseChat, reflète l'état dans apiKeys[provider.name]
  setApiKey, // C'est la fonction onApiKeysChange de BaseChat, qui met à jour l'état ET les cookies
  getApiKeyLink,
  labelForGetApiKey,
  onKeyRequiredStatusChange, // La nouvelle prop pour communiquer avec BaseChat
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [isEnvKeySet, setIsEnvKeySet] = useState(false);

  useEffect(() => {
    setTempKey(apiKey);
    if (apiKey && isEditing) {
      setIsEditing(false);
    }
  }, [apiKey, isEditing]); // Ajout de isEditing aux dépendances pour une logique plus robuste

  useEffect(() => {
    // Inutile de recharger depuis les cookies ici, BaseChat gère l'initialisation de `apiKey`
    // On s'assure juste que tempKey est synchronisé et que le mode édition est désactivé.
    setTempKey(apiKey); // Synchronise tempKey avec la nouvelle apiKey du provider
    setIsEditing(false);
  }, [provider.name, apiKey]); // Dépend aussi de apiKey pour refléter les changements externes

  const checkEnvApiKey = useCallback(async () => {
    if (!provider?.name) return;
    if (providerEnvKeyStatusCache[provider.name] !== undefined) {
      setIsEnvKeySet(providerEnvKeyStatusCache[provider.name]);
      return;
    }
    try {
      const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(provider.name)}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      const isSet = (data as { isSet: boolean }).isSet;
      providerEnvKeyStatusCache[provider.name] = isSet;
      setIsEnvKeySet(isSet);
    } catch (error) {
      console.error(`Failed to check environment API key for ${provider.name}:`, error);
      setIsEnvKeySet(false);
    }
  }, [provider?.name]);

  useEffect(() => {
    checkEnvApiKey();
  }, [checkEnvApiKey]);

  useEffect(() => {
    if (onKeyRequiredStatusChange && provider?.name) {
      const keyIsEffectivelySet = !!apiKey || isEnvKeySet;
      onKeyRequiredStatusChange(!keyIsEffectivelySet, provider.name);
    }
  }, [apiKey, isEnvKeySet, provider?.name, onKeyRequiredStatusChange]);

  const handleSave = () => {
    setApiKey(tempKey.trim()); // `setApiKey` est `onApiKeysChange` de BaseChat.
    // L'useEffect sur [apiKey] s'occupera de setIsEditing(false) et de resynchroniser tempKey si nécessaire.
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setTempKey(apiKey);
  };

  const keyIsSetViaUI = !!apiKey;
  const keyIsNotSetAtAll = !keyIsSetViaUI && !isEnvKeySet;

  return (
    <div className="w-full"> {/* Ajout d'un conteneur parent pour englober les deux sections */}
      {/* Section originale pour l'affichage du statut et l'édition en ligne */}
      <div className="sr-only items-center justify-between py-3 px-1 text-sm">
        <div className="flex items-center gap-2 flex-1">
          <span className="font-medium text-bolt-elements-textSecondary">
            {provider?.name} API Key:
          </span>
          {!isEditing && (
            <div className="flex items-center gap-1">
              {keyIsSetViaUI ? (
                <>
                  <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                  <span className="text-xs text-green-500">Set via UI</span>
                </>
              ) : isEnvKeySet ? (
                <>
                  <div className="i-ph:check-circle-fill text-green-500 w-4 h-4" />
                  <span className="text-xs text-green-500">Set via environment variable</span>
                </>
              ) : (
                <>
                  <div className="i-ph:x-circle-fill text-red-500 w-4 h-4" />
                  <span className="text-xs text-red-500">Not Set</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <input
                type="password"
                value={tempKey}
                placeholder="Enter API Key"
                onChange={(e) => setTempKey(e.target.value)}
                className="w-[200px] sm:w-[300px] px-3 py-1.5 text-sm rounded border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
              />
              <IconButton
                onClick={handleSave}
                title="Save API Key"
                className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
                disabled={!tempKey.trim() || tempKey === apiKey}
              >
                <div className="i-ph:check w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={handleCancelEdit}
                title="Cancel"
                className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
              >
                <div className="i-ph:x w-4 h-4" />
              </IconButton>
            </>
          ) : (
            <>
              {(!isEnvKeySet || keyIsSetViaUI) && (
                <IconButton
                  onClick={() => {
                    setTempKey(apiKey); // S'assurer que tempKey est à jour avant d'éditer
                    setIsEditing(true);
                  }}
                  title={keyIsSetViaUI ? "Edit API Key" : "Add API Key"}
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
                >
                  <div className="i-ph:pencil-simple w-4 h-4" />
                </IconButton>
              )}
              {provider?.getApiKeyLink && keyIsNotSetAtAll && (
                 <IconButton
                    onClick={() => window.open(provider.getApiKeyLink, '_blank')}
                    title={`Get ${provider.name} API Key`}
                    className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 flex items-center gap-2"
                >
                    <span className="text-xs whitespace-nowrap">
                        {labelForGetApiKey || `Get ${provider.name} Key`}
                    </span>
                    <div className={`${provider.icon || 'i-ph:key'} w-4 h-4`} />
                </IconButton>
              )}
            </>
          )}
        </div>
      </div>

      {/* NOUVEAU: Conteneur pour ajouter une clé API si aucune n'est définie */}
      {keyIsNotSetAtAll && !isEditing && ( // S'affiche seulement si aucune clé n'est définie ET qu'on n'est pas déjà en mode édition
        <div className='fixed h-full w-full top-0 left-0 z-[9999] flex items-center justify-center'>
          <div className=" absolute bottom-0   p-3 border-t border border-[#eee] px-4 rounded-t-[16px]  bg-[#fff] text-[#222] h-[50%] w-full"> {/* Styles à ajuster */}
          <div className='h-[200px] flex items-center flex-col gap-2 justify-center w-full bg-[#] rounded-[15px] relative'>
            <h2 className="text-3xl font-semibold">Configure your Gemini API Key first</h2>
            <div className="flex items-center gap-1 md:w-[600px] not-md:w-[80%]">
              <input
               className='py-3 h-[40px] px-5 text-sm w-[70%] rounded-[18px] bg-[#EDEDEDB8] placeholder:text-[#888] '
               type="password"
              value={tempKey} // Réutilise tempKey
              placeholder={`Enter ${provider?.name || 'Provider'} API Key`}
              onChange={(e) => setTempKey(e.target.value)}
               />
               <button
                disabled={!tempKey.trim()}
                onClick={handleSave}
               className='py-3 h-[40px] px-5 text-sm w-[30%] rounded-[18px] bg-[#000000] text-[#FAFAFA]'
               >
                <span className='relative -top-[3px] text-[14px]'>Set API key</span>
               </button>
            </div>
            <div className="flex fixed bottom-3 items-center text-1xl gap-1">
              Not API key ? 
              {provider?.getApiKeyLink && (
              <a
                href={provider.getApiKeyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#888]  underline"
              >
                get one here
              </a>
            )}.
            </div>
          </div>
          <div className="absolute top-2 left-2">
          <svg
  aria-hidden="true"
  className="flower-mob h-[140px] w-[140px] animate-spin transition-all delay-[2s]"
  fill="none"
  style={{
    rotate: "none",
    scale: "none",
    transform: "translate(0px, 0px)",
    translate: "none",
  }}
  viewBox="0 0 62 62"
  xmlns="http://www.w3.org/2000/svg"
  xmlnsXlink="http://www.w3.org/1999/xlink">
  <path
    clipRule="evenodd"
    d="M18.256 30.33c-1.001.211-2.038.322-3.1.322C6.786 30.651 0 23.79 0 15.325S6.785 0 15.155 0s15.156 6.862 15.156 15.326c0 .709-.048 1.406-.14 2.09h1.657c-.092-.684-.14-1.381-.14-2.09C31.689 6.862 38.475 0 46.845 0 55.214 0 62 6.862 62 15.326S55.214 30.65 46.844 30.65c-.94 0-1.862-.086-2.755-.252V31.6a15.083 15.083 0 0 1 2.755-.252C55.214 31.349 62 38.21 62 46.674 62 55.138 55.214 62 46.844 62c-8.37 0-15.155-6.862-15.155-15.326 0-1.074.11-2.123.317-3.135h-1.945c.164.904.25 1.835.25 2.787 0 8.464-6.785 15.326-15.155 15.326S0 54.79 0 46.326 6.785 31 15.155 31c1.063 0 2.1.11 3.1.321v-.99Z"
    fill="url(#home-animate-anything-flower-mobile-a)"
    fillRule="evenodd"
  />
  <path
    clipRule="evenodd"
    d="M18.256 30.33c-1.001.211-2.038.322-3.1.322C6.786 30.651 0 23.79 0 15.325S6.785 0 15.155 0s15.156 6.862 15.156 15.326c0 .709-.048 1.406-.14 2.09h1.657c-.092-.684-.14-1.381-.14-2.09C31.689 6.862 38.475 0 46.845 0 55.214 0 62 6.862 62 15.326S55.214 30.65 46.844 30.65c-.94 0-1.862-.086-2.755-.252V31.6a15.083 15.083 0 0 1 2.755-.252C55.214 31.349 62 38.21 62 46.674 62 55.138 55.214 62 46.844 62c-8.37 0-15.155-6.862-15.155-15.326 0-1.074.11-2.123.317-3.135h-1.945c.164.904.25 1.835.25 2.787 0 8.464-6.785 15.326-15.155 15.326S0 54.79 0 46.326 6.785 31 15.155 31c1.063 0 2.1.11 3.1.321v-.99Z"
    fill="url(#home-animate-anything-flower-mobile-b)"
    fillOpacity=".6"
    fillRule="evenodd"
  />
  <defs>
    <linearGradient
      gradientUnits="userSpaceOnUse"
      id="home-animate-anything-flower-mobile-a"
      x1="50.449"
      x2=".172"
      y1="74.75"
      y2="20.03">
      <stop offset=".144" stopColor="#FFE9FE" />
      <stop offset="1" stopColor="#FF96F9" />
    </linearGradient>
    <pattern
      height="1.613"
      id="home-animate-anything-flower-mobile-b"
      patternContentUnits="objectBoundingBox"
      width="1.613">
      <use transform="scale(.00323)" xlinkHref="#svg-noise" />
    </pattern>
  </defs>
</svg>

          </div>
          <div className="absolute bottom-2 right-2">
          <svg
  aria-hidden="true"
  className="flower-mob h-[140px] w-[140px] animate-spin transition-all delay-[2s]"
  fill="none"
  style={{
    rotate: "none",
    scale: "none",
    transform: "translate(0px, 0px)",
    translate: "none",
  }}
  viewBox="0 0 62 62"
  xmlns="http://www.w3.org/2000/svg"
  xmlnsXlink="http://www.w3.org/1999/xlink">
  <path
    clipRule="evenodd"
    d="M18.256 30.33c-1.001.211-2.038.322-3.1.322C6.786 30.651 0 23.79 0 15.325S6.785 0 15.155 0s15.156 6.862 15.156 15.326c0 .709-.048 1.406-.14 2.09h1.657c-.092-.684-.14-1.381-.14-2.09C31.689 6.862 38.475 0 46.845 0 55.214 0 62 6.862 62 15.326S55.214 30.65 46.844 30.65c-.94 0-1.862-.086-2.755-.252V31.6a15.083 15.083 0 0 1 2.755-.252C55.214 31.349 62 38.21 62 46.674 62 55.138 55.214 62 46.844 62c-8.37 0-15.155-6.862-15.155-15.326 0-1.074.11-2.123.317-3.135h-1.945c.164.904.25 1.835.25 2.787 0 8.464-6.785 15.326-15.155 15.326S0 54.79 0 46.326 6.785 31 15.155 31c1.063 0 2.1.11 3.1.321v-.99Z"
    fill="url(#home-animate-anything-flower-mobile-a)"
    fillRule="evenodd"
  />
  <path
    clipRule="evenodd"
    d="M18.256 30.33c-1.001.211-2.038.322-3.1.322C6.786 30.651 0 23.79 0 15.325S6.785 0 15.155 0s15.156 6.862 15.156 15.326c0 .709-.048 1.406-.14 2.09h1.657c-.092-.684-.14-1.381-.14-2.09C31.689 6.862 38.475 0 46.845 0 55.214 0 62 6.862 62 15.326S55.214 30.65 46.844 30.65c-.94 0-1.862-.086-2.755-.252V31.6a15.083 15.083 0 0 1 2.755-.252C55.214 31.349 62 38.21 62 46.674 62 55.138 55.214 62 46.844 62c-8.37 0-15.155-6.862-15.155-15.326 0-1.074.11-2.123.317-3.135h-1.945c.164.904.25 1.835.25 2.787 0 8.464-6.785 15.326-15.155 15.326S0 54.79 0 46.326 6.785 31 15.155 31c1.063 0 2.1.11 3.1.321v-.99Z"
    fill="url(#home-animate-anything-flower-mobile-b)"
    fillOpacity=".6"
    fillRule="evenodd"
  />
  <defs>
    <linearGradient
      gradientUnits="userSpaceOnUse"
      id="home-animate-anything-flower-mobile-a"
      x1="50.449"
      x2=".172"
      y1="74.75"
      y2="20.03">
      <stop offset=".144" stopColor="#FFE9FE" />
      <stop offset="1" stopColor="#FF96F9" />
    </linearGradient>
    <pattern
      height="1.613"
      id="home-animate-anything-flower-mobile-b"
      patternContentUnits="objectBoundingBox"
      width="1.613">
      <use transform="scale(.00323)" xlinkHref="#svg-noise" />
    </pattern>
  </defs>
</svg>

          </div>
          
        </div>
        </div>
      )}
    </div>
  );
};
