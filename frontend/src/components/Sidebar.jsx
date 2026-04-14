import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Settings, ChevronUp, ChevronDown } from 'lucide-react';

const Sidebar = ({ 
  isMobile, 
  mobileSidebarOpen, 
  setMobileSidebarOpen, 
  conversations, 
  activeChatId, 
  handleConversationSelect, 
  createNewChat, // On utilise exactement le nom envoyé par ChatPage
  deleteConversation, 
  formatDate,
  sidebarSettings, 
  updateSidebarSetting 
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {isMobile && mobileSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
      )}
      
      <aside className={`sidebar-panel ${isMobile ? 'mobile' : ''} ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <div className="sidebar-actions">
            <p className="sidebar-section-title">Historique</p>
            {/* CORRECTION : On appelle createNewChat() au clic */}
            <button 
              className="new-chat-btn" 
              onClick={() => {
                createNewChat();
                if(isMobile) setMobileSidebarOpen(false); // Ferme la sidebar sur mobile après clic
              }}
            >
              <Plus size={15} /> Nouvelle
            </button>
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="history-list">
            {conversations.map((chat) => (
              <div 
                key={chat.id} 
                className={`history-item ${chat.id === activeChatId ? 'active' : ''}`} 
                onClick={() => handleConversationSelect(chat.id)}
              >
                <div className="history-icon"><MessageSquare size={15} /></div>
                <div className="history-content">
                  <p className="history-title">{chat.title}</p>
                  <p className="history-date">{formatDate(chat.updatedAt || chat.createdAt)}</p>
                </div>
                <button 
                  className="history-delete" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    deleteConversation(chat.id); 
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-settings-card">
            <button 
              className={`sidebar-settings-toggle ${settingsOpen ? 'open' : ''}`} 
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <span className="sidebar-settings-toggle-left">
                <Settings size={17} />
                <span>Configuration</span>
              </span>
              {settingsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {settingsOpen && (
              <div className="sidebar-settings-body">
                <div className="sidebar-form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={sidebarSettings.autoChart} 
                      onChange={(e) => updateSidebarSetting('autoChart', e.target.checked)}
                    />
                    <span style={{ fontSize: '12px' }}>Graphiques automatiques</span>
                  </label>
                </div>

                <div className="sidebar-form-group">
                  <label>Modèle</label>
                  <select 
                    className="sidebar-select" 
                    value={sidebarSettings.model} 
                    onChange={(e) => updateSidebarSetting('model', e.target.value)}
                  >
                    <option value="Qwen2.5-Coder-14B">Qwen2.5-Coder-14B</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;