import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';

// Layout & Components
import Sidebar from '../components/Sidebar';
import Header from '../layout/Header';
import { useConversations } from '../hooks/useConversations';

// Icons
import { 
  Mail, Send, CheckCircle2, Circle, 
  FileStack, AtSign, History, X, Sparkles,
  FileSpreadsheet, Code, Loader2, Type
} from 'lucide-react';

// Styles
import './ChatPage.css';

const API_BASE = 'http://localhost:8000/api';
const CONTACTS_STORAGE_KEY = 'text_to_sql_recent_contacts';
const DRAFT_STORAGE_KEY = 'text_to_sql_email_draft';

// --- COMPOSANT DE NOTIFICATION INTERNE ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px', padding: '12px 20px',
      borderRadius: '8px', color: '#fff', zIndex: 1000, display: 'flex',
      alignItems: 'center', gap: '10px', fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      backgroundColor: type === 'success' ? '#10b981' : '#ef4444',
      animation: 'slideIn 0.3s ease-out'
    }}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <X size={12} />}
      {message}
    </div>
  );
};

const PartagePage = () => {
  const { conversations, activeChatId, setActiveChatId } = useConversations();

  // --- ÉTATS ---
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]); 
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  // États persistants
  const [emailSubject, setEmailSubject] = useState(() => {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? JSON.parse(saved).subject : '';
  }); 
  const [emailInput, setEmailInput] = useState('');
  const [recipients, setRecipients] = useState(() => {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? JSON.parse(saved).recipients : [];
  }); 
  const [includeData, setIncludeData] = useState(false); 
  const [isSending, setIsSending] = useState(false);
  const [emailBody, setEmailBody] = useState(() => {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? JSON.parse(saved).body : '';
  });
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [recentEmails, setRecentEmails] = useState(() => {
    const saved = localStorage.getItem(CONTACTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Sauvegarde auto du brouillon
  useEffect(() => {
    const draft = { subject: emailSubject, recipients, body: emailBody };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [emailSubject, recipients, emailBody]);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeChatId) || conversations[0];
  }, [conversations, activeChatId]);

  const filteredSuggestions = useMemo(() => {
    if (!emailInput) return [];
    return recentEmails.filter(email => 
      email.toLowerCase().includes(emailInput.toLowerCase()) && !recipients.includes(email)
    );
  }, [emailInput, recentEmails, recipients]);

  // --- LOGIQUE NOTIFICATION ---
  const notify = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // --- GESTION DESTINATAIRES ---
  const addRecipient = (email) => {
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmedEmail && emailRegex.test(trimmedEmail) && !recipients.includes(trimmedEmail)) {
      setRecipients([...recipients, trimmedEmail]);
      setEmailInput('');
      setShowSuggestions(false);
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

  // --- GESTION SÉLECTION ---
  const toggleSelection = (msg) => {
    const isAlreadySelected = selectedItems.some(item => item.id === msg.id);
    if (isAlreadySelected) {
      setSelectedItems(selectedItems.filter(item => item.id !== msg.id));
    } else {
      const msgIndex = activeConversation.messages.findIndex(m => m.id === msg.id);
      const questionText = activeConversation.messages[msgIndex - 1]?.content || "Analyse SQL";
      setSelectedItems([...selectedItems, { 
        id: msg.id, 
        question: questionText, 
        sql: msg.sql, 
        chatTitle: activeConversation.title 
      }]);
    }
  };

  // --- GÉNÉRATION IA ---
  const handleAIEmailGenerate = async () => {
    if (selectedItems.length === 0) return notify("Sélectionnez d'abord des requêtes.", "error");
    setIsGeneratingEmail(true);
    try {
      const response = await axios.post(`${API_BASE}/reports/generate-email`, { items: selectedItems });
      setEmailBody(response.data.text);
      setEmailSubject(response.data.subject || `Analyse Data : ${activeConversation?.title}`);
      notify("Email généré avec succès !");
    } catch (err) {
      setEmailBody(`Bonjour,\n\nVeuillez trouver ci-joint l'analyse SQL.\n\nCordialement.`);
      setEmailSubject(`Rapport d'analyse - ${new Date().toLocaleDateString()}`);
      notify("Utilisation du modèle par défaut.", "success");
    } finally { setIsGeneratingEmail(false); }
  };

  // --- ENVOI FINAL ---
  const sendFinalReport = async () => {
    if (recipients.length === 0 || !emailBody || selectedItems.length === 0 || !emailSubject) {
      return notify("Champs incomplets ou aucune sélection.", "error");
    }
    
    setIsSending(true);
    try {
      const payload = {
        to: recipients,
        subject: emailSubject, 
        content: emailBody,
        include_csv: includeData, 
        queries: selectedItems.map(item => ({ question: item.question, sql: item.sql }))
      };

      await axios.post(`${API_BASE}/reports/send`, payload);

      let updatedHistory = [ ...new Set([...recipients, ...recentEmails]) ].slice(0, 15);
      setRecentEmails(updatedHistory);
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(updatedHistory));

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setRecipients([]); setSelectedItems([]); setEmailBody(''); setEmailSubject('');
      
      notify("Email envoyé avec succès !");
    } catch (err) { 
      notify("Erreur lors de l'envoi.", "error"); 
    } finally { setIsSending(false); }
  };

  return (
    <div className={`chatpage ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
      
      <Sidebar 
        conversations={conversations} 
        activeChatId={activeChatId} 
        handleConversationSelect={setActiveChatId} 
        formatDate={(d) => new Date(d).toLocaleDateString('fr-FR')} 
      />

      <main className="workspace" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f3f4f6' }}>
        <Header setSidebarCollapsed={setSidebarCollapsed} activeConversationTitle="Générateur de Rapport" />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '15px', gap: '15px' }}>
          
          {/* SECTION 1: SÉLECTION */}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>1. Choisir les requêtes</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
              {activeConversation?.messages?.filter(m => m.role === 'bot' && m.sql).map((msg) => {
                const isSelected = selectedItems.some(i => i.id === msg.id);
                const question = activeConversation.messages[activeConversation.messages.indexOf(msg)-1]?.content;
                return (
                  <div key={msg.id} onClick={() => toggleSelection(msg)} style={{
                    padding: '12px', borderRadius: '10px', border: `2px solid ${isSelected ? '#0d5395' : '#f3f4f6'}`,
                    cursor: 'pointer', marginBottom: '10px', backgroundColor: isSelected ? '#eff6ff' : '#fff',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {isSelected ? <CheckCircle2 size={18} color="#0d5395" /> : <Circle size={18} color="#d1d5db" />}
                      <span style={{ fontSize: '13px' }}>{question}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 2: PANIER */}
          <section style={{ width: '220px', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700' }}><FileStack size={16} /> Panier ({selectedItems.length})</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {selectedItems.map(item => (
                <div key={item.id} style={{ fontSize: '11px', padding: '8px', borderBottom: '1px solid #f3f4f6', position: 'relative' }}>
                  <X size={10} style={{ position: 'absolute', right: 5, cursor: 'pointer' }} onClick={() => toggleSelection(item)} />
                  <strong>{item.chatTitle}</strong><br/>{item.question.substring(0, 50)}...
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3: ENVOI */}
          <section style={{ flex: 1.3, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '15px', gap: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700' }}><AtSign size={18} /> 2. Envoi du Rapport</h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px' }}>
              <Type size={16} color="#6b7280" />
              <input 
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Objet de l'email..."
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px' }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '5px', display: 'flex', flexWrap: 'wrap', gap: '5px', minHeight: '45px' }}>
                {recipients.map(email => (
                  <span key={email} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#0d5395', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    {email} <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeRecipient(email)} />
                  </span>
                ))}
                <input 
                  value={emailInput} 
                  onChange={(e) => { setEmailInput(e.target.value); setShowSuggestions(true); }} 
                  onKeyDown={handleKeyDown} 
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Destinataires..." 
                  style={{ border: 'none', outline: 'none', flex: 1, fontSize: '13px', minWidth: '120px' }} 
                />
              </div>

              {showSuggestions && filteredSuggestions.length > 0 && (
                <div style={{ 
                  position: 'absolute', top: '105%', left: 0, right: 0, 
                  backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '150px', overflowY: 'auto'
                }}>
                  {filteredSuggestions.map((email) => (
                    <div 
                      key={email}
                      onClick={() => addRecipient(email)}
                      style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      {email}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', backgroundColor: '#f3f4f6', padding: '5px', borderRadius: '10px' }}>
              <button onClick={() => setIncludeData(false)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', backgroundColor: !includeData ? '#fff' : 'transparent', fontWeight: 'bold', color: !includeData ? '#0d5395' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Code size={14} /> SQL seul
              </button>
              <button onClick={() => setIncludeData(true)} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', backgroundColor: includeData ? '#fff' : 'transparent', fontWeight: 'bold', color: includeData ? '#10b981' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <FileSpreadsheet size={14} /> Inclure CSV
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Message :</span>
                <button onClick={handleAIEmailGenerate} disabled={isGeneratingEmail} style={{ border: 'none', background: 'none', color: '#f59e0b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={14} /> {isGeneratingEmail ? "Génération..." : "IA Rédiger"}
                </button>
              </div>
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} style={{ flex: 1, borderRadius: '8px', border: '1px solid #d1d5db', padding: '10px', fontSize: '13px', resize: 'none' }} placeholder="Corps de l'email..." />
            </div>

            <button onClick={sendFinalReport} disabled={isSending || selectedItems.length === 0} style={{ padding: '15px', backgroundColor: '#0d5395', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Envoyer l'email {includeData ? "(+ CSV)" : ""}
            </button>
          </section>
        </div>
      </main>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default PartagePage;