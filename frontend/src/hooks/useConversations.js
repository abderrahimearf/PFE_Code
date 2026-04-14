import { useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  model: 'Qwen2.5-Coder-14B',
  host: 'localhost',
  user: 'admin',
  database: 'my_database',
  autoChart: true,
};

export const useConversations = () => {
  const STORAGE_KEY = 'text_to_sql_conversations_v1';
  const SETTINGS_KEY = 'text_to_sql_settings_v1';
  const MAX_CONVERSATIONS = 10; // Limite pour éviter la lenteur

  // 1. Initialisation des conversations
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Erreur de parsing localstorage", e);
      }
    }
    return [{ id: Date.now().toString(), title: 'Nouvelle conversation', messages: [] }];
  });

  // 2. Initialisation du chat actif
  const [activeChatId, setActiveChatId] = useState(() => {
    return localStorage.getItem('active_chat_id') || (conversations[0]?.id);
  });

  // 3. Initialisation des paramètres
  const [sidebarSettings, setSidebarSettings] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // 4. SYNC & NETTOYAGE (Le coeur de la solution)
  useEffect(() => {
    // --- ÉTAPE A : Limiter le nombre de chats ---
    const limitedChats = conversations.slice(0, MAX_CONVERSATIONS);

    // --- ÉTAPE B : Nettoyer les données volatiles ---
    // On retire les résultats (data) pour ne pas saturer le stockage
    // On garde la structure (colonnes, sql, row_count) pour l'affichage
    const lightChats = limitedChats.map(chat => ({
      ...chat,
      messages: chat.messages.map(msg => {
        if (msg.role === 'bot' && msg.result) {
          return {
            ...msg,
            result: {
              ...msg.result,
              data: [] // On vide le tableau lourd
            },
            tableOpen: false, // Fermer par défaut au rechargement
            chartOpen: false
          };
        }
        return msg;
      })
    }));

    // --- ÉTAPE C : Sauvegarde effective ---
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightChats));
    
    if (activeChatId) {
      localStorage.setItem('active_chat_id', activeChatId);
    }
    
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(sidebarSettings));
  }, [conversations, activeChatId, sidebarSettings]);

  // Fonction pour mettre à jour les réglages (modèle, host, etc.)
  const updateSidebarSetting = (field, value) => {
    setSidebarSettings(prev => ({ ...prev, [field]: value }));
  };

  return { 
    conversations, 
    setConversations, 
    activeChatId, 
    setActiveChatId, 
    sidebarSettings, 
    updateSidebarSetting 
  };
};