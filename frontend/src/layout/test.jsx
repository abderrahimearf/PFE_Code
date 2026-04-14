import React, { useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../layout/Header';
import { useConversations } from '../hooks/useConversations';
import { 
  Mail, Send, CheckCircle2, Circle, Wand2, 
  FileStack, Trash2, AtSign, History, X, Sparkles
} from 'lucide-react';
import axios from 'axios';
import './ChatPage.css';

const API_BASE = 'http://localhost:8000/api';
const CONTACTS_STORAGE_KEY = 'text_to_sql_recent_contacts';

const Report = () => {
  const { 
    conversations, 
    setConversations, 
    activeChatId, 
    setActiveChatId, 
    sidebarSettings, 
    updateSidebarSetting 
  } = useConversations();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]); 
  
  // ÉTATS DESTINATAIRES
  const [emailInput, setEmailInput] = useState('');
  const [recipients, setRecipients] = useState([]); 
  
  // ÉTATS MESSAGE
  const [emailBody, setEmailBody] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  // HISTORIQUE DES CONTACTS
  const [recentEmails, setRecentEmails] = useState(() => {
    const saved = localStorage.getItem(CONTACTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeChatId) || conversations[0];
  }, [conversations, activeChatId]);

  // --- GESTION DES DESTINATAIRES ---
  const addRecipient = (email) => {
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmedEmail && emailRegex.test(trimmedEmail) && !recipients.includes(trimmedEmail)) {
      setRecipients([...recipients, trimmedEmail]);
      setEmailInput('');
    }
  };

  const removeRecipient = (email) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleKeyDown = (e) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault();
      addRecipient(emailInput);
    }
  };

  // --- GESTION DE LA SÉLECTION ---
  const toggleSelection = (msg, chatTitle) => {
    const isAlreadySelected = selectedItems.some(item => item.id === msg.id);
    if (isAlreadySelected) {
      setSelectedItems(selectedItems.filter(item => item.id !== msg.id));
    } else {
      const msgIndex = activeConversation.messages.findIndex(m => m.id === msg.id);
      const questionText = activeConversation.messages[msgIndex - 1]?.content || "Analyse";
      setSelectedItems([...selectedItems, { id: msg.id, question: questionText, sql: msg.sql, chatTitle }]);
    }
  };

  // --- GÉNÉRATION IA (Correction de l'URL vers /reports/...) ---
  const handleAIEmailGenerate = async () => {
    if (selectedItems.length === 0) return alert("Sélectionnez d'abord des requêtes.");
    setIsGeneratingEmail(true);
    try {
      const response = await axios.post(`${API_BASE}/reports/generate-email`, {
        items: selectedItems
      });
      setEmailBody(response.data.text);
    } catch (err) {
      const fallback = `Bonjour,\n\nVeuillez trouver ci-joint l'analyse SQL pour les points suivants :\n\n` + 
        selectedItems.map(i => `- ${i.question}`).join('\n') + `\n\nCordialement.`;
      setEmailBody(fallback);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  // --- ENVOI FINAL ---
  const sendFinalReport = async () => {
    if (recipients.length === 0 || !emailBody || selectedItems.length === 0) {
      return alert("Veuillez remplir tous les champs (destinataires, message et sélection).");
    }
    try {
      await axios.post(`${API_BASE}/reports/send`, {
        to: recipients,
        content: emailBody,
        queries: selectedItems
      });

      // Sauvegarde des emails dans l'historique
      let updatedHistory = [...recentEmails];
      recipients.forEach(email => {
        updatedHistory = [email, ...updatedHistory.filter(e => e !== email)];
      });
      const finalHistory = updatedHistory.slice(0, 8);
      setRecentEmails(finalHistory);
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(finalHistory));

      alert("Rapport envoyé avec succès !");
      setRecipients([]);
      setSelectedItems([]);
      setEmailBody('');
    } catch (err) {
      alert("Erreur lors de l'envoi.");
    }
  };

  return (
    <div className={`chatpage ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        conversations={conversations} 
        activeChatId={activeChatId} 
        handleConversationSelect={setActiveChatId} 
        createNewChat={() => {}} 
        sidebarSettings={sidebarSettings} 
        updateSidebarSetting={updateSidebarSetting}
        formatDate={(d) => new Date(d).toLocaleDateString('fr-FR')} 
        deleteConversation={(id) => setConversations(prev => prev.filter(c => c.id !== id))} 
      />

      <main className="workspace" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header setSidebarCollapsed={setSidebarCollapsed} activeConversationTitle="Générateur de Rapport" />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '15px', gap: '15px', backgroundColor: '#f3f4f6' }}>
          
          {/* 1. SELECTION DES REQUÊTES (GAUCHE) */}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>1. Choisir les requêtes</h3>
              <p style={{ fontSize: '11px', color: '#6b7280' }}>Source : {activeConversation?.title}</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
              {activeConversation?.messages?.filter(m => m.role === 'bot' && m.sql).map((msg) => {
                const isSelected = selectedItems.some(i => i.id === msg.id);
                return (
                  <div key={msg.id} onClick={() => toggleSelection(msg, activeConversation.title)} style={{
                    padding: '12px', borderRadius: '10px', border: `2px solid ${isSelected ? '#0d5395' : '#f3f4f6'}`,
                    cursor: 'pointer', marginBottom: '10px', backgroundColor: isSelected ? '#eff6ff' : '#fff'
                  }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {isSelected ? <CheckCircle2 size={18} color="#0d5395" /> : <Circle size={18} color="#d1d5db" />}
                      <span style={{ fontSize: '13px' }}>{activeConversation.messages[activeConversation.messages.indexOf(msg)-1]?.content}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. RECAPITULATIF PANIER (CENTRE) */}
          <section style={{ width: '220px', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700' }}><FileStack size={16} /> Panier ({selectedItems.length})</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {selectedItems.map(item => (
                <div key={item.id} style={{ fontSize: '11px', padding: '8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
                  <strong>{item.chatTitle}</strong><br/>{item.question}
                </div>
              ))}
            </div>
          </section>

          {/* 3. DESTINATAIRES & EMAIL (DROITE) */}
          <section style={{ flex: 1.3, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '15px', gap: '15px' }}>
            
            {/* DESTINATAIRES */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '10px' }}><AtSign size={18} /> 2. Destinataires</h3>
              <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '5px', display: 'flex', flexWrap: 'wrap', gap: '5px', backgroundColor: '#fff', minHeight: '45px' }}>
                {recipients.map(email => (
                  <span key={email} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#0d5395', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    {email} <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeRecipient(email)} />
                  </span>
                ))}
                <input 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => addRecipient(emailInput)}
                  placeholder="emails..."
                  style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px' }}
                />
              </div>

              {/* SUGGESTIONS RÉCENTES */}
              {recentEmails.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <History size={14} color="#6b7280" />
                  {recentEmails.map(email => (
                    <button key={email} onClick={() => addRecipient(email)} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', color: '#4b5563' }}>
                      + {email}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* MESSAGE AVEC BOUTON IA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}><Mail size={18} /> 3. Message</h3>
                
                <button 
                  onClick={handleAIEmailGenerate}
                  disabled={selectedItems.length === 0 || isGeneratingEmail}
                  style={{ 
                    padding: '6px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', 
                    cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' 
                  }}
                >
                  <Sparkles size={14} /> {isGeneratingEmail ? "Génération..." : "Rédiger avec l'IA"}
                </button>
              </div>

              <textarea 
                value={emailBody} 
                onChange={(e) => setEmailBody(e.target.value)} 
                style={{ flex: 1, width: '100%', borderRadius: '8px', border: '1px solid #d1d5db', padding: '10px', fontSize: '13px', resize: 'none' }} 
                placeholder="Rédigez votre message ou utilisez l'IA..." 
              />
            </div>

            <button 
              onClick={sendFinalReport} 
              disabled={recipients.length === 0 || selectedItems.length === 0}
              style={{ padding: '15px', backgroundColor: '#0d5395', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: (recipients.length === 0 || selectedItems.length === 0) ? 0.7 : 1 }}
            >
              <Send size={18} /> Envoyer aux {recipients.length} personnes
            </button>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Report;