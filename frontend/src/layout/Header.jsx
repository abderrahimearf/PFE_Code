import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Sparkles, 
  MessageSquare, 
  LayoutDashboard, 
  FileText,
  Share2 
} from 'lucide-react';
import logoCDM from '../assets/logo-cdm.png';

const Header = ({ isMobile, setMobileSidebarOpen, setSidebarCollapsed, activeConversationTitle }) => {
  const navigate = useNavigate();
  let dragTimer = null;

  const handleDragEnter = (path) => {
    dragTimer = setTimeout(() => {
      navigate(path);
    }, 500);
  };

  const handleDragLeave = () => {
    if (dragTimer) clearTimeout(dragTimer);
  };

  return (
    <header className="workspace-header">
      <div className="workspace-header-left">
        <button
          className="header-menu-btn"
          type="button"
          onClick={() => (isMobile ? setMobileSidebarOpen(true) : setSidebarCollapsed((prev) => !prev))}
          title="Afficher/Masquer le panneau"
        >
          <Menu size={20} />
        </button>

        <div className="header-logo">
          <img src={logoCDM} alt="Logo Crédit du Maroc" />
        </div>

        <div className="header-copy is-desktop">
          <h1 className="header-title">Text-to-SQL</h1>
        </div>

        <nav className="header-navigation">
          <NavLink 
            to="/" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onDragEnter={() => handleDragEnter('/')}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
          >
            <MessageSquare size={18} />
            <span>Chat</span>
          </NavLink>

          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onDragEnter={() => handleDragEnter('/dashboard')}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink 
            to="/reportpage" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onDragEnter={() => handleDragEnter('/reportpage')}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
          >
            <FileText size={18} />
            <span>Rapport</span>
          </NavLink>

          <NavLink 
            to="/PartagePage" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onDragEnter={() => handleDragEnter('/PartagePage')}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
          >
            <Share2 size={18} />
            <span>Partage</span>
          </NavLink>
        </nav>
      </div>

      <div className="header-badge">
        <Sparkles size={14} className="badge-icon" />
        <span className="truncate-text">{activeConversationTitle || 'Nouvelle discussion'}</span>
      </div>
    </header>
  );
};

export default Header;