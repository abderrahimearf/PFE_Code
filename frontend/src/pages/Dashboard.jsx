import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../layout/Header';
import { useConversations } from '../hooks/useConversations';
import { LayoutDashboard, Sparkles, X, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { ChartRenderer } from './ChatPage'; 
import './ChatPage.css';

const Dashboard = () => {
  const { conversations, setConversations, activeChatId, setActiveChatId } = useConversations();
  const [widgets, setWidgets] = useState(() => {
    const saved = localStorage.getItem('my_dashboard_widgets');
    return saved ? JSON.parse(saved) : [];
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [zoomedWidget, setZoomedWidget] = useState(null); // Pour le mode Zoom

  useEffect(() => {
    localStorage.setItem('my_dashboard_widgets', JSON.stringify(widgets));
  }, [widgets]);

  const activeConversation = useMemo(() => {
    return conversations.find((chat) => chat.id === activeChatId) || conversations[0];
  }, [conversations, activeChatId]);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      setWidgets(prev => [...prev, { id: `w-${Date.now()}`, ...data }]);
    } catch (err) { console.error(err); }
  };

  const removeWidget = (id) => setWidgets(prev => prev.filter(w => w.id !== id));

  return (
    <div className={`chatpage ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar 
        isMobile={window.innerWidth <= 980}
        conversations={conversations}
        activeChatId={activeChatId}
        handleConversationSelect={setActiveChatId}
        formatDate={(d) => new Date(d).toLocaleDateString('fr-FR')}
      />

      <main className="workspace" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
        <Header setSidebarCollapsed={setSidebarCollapsed} activeConversationTitle="Flex Dashboard" />

        {/* --- HEADER --- */}
        <div className="dashboard-header-bar" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 24px', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard size={20} color="#0d5395" />
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Tableau de Bord <span style={{ color: '#94a3b8', fontWeight: '400' }}>| {activeConversation?.title}</span></h2>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => alert("IA Génération...")} className="btn-dash-primary"><Sparkles size={14} /> IA Générer</button>
            <button onClick={() => setWidgets([])} className="btn-dash-danger"><Trash2 size={14} /> Vider</button>
          </div>
        </div>

        {/* --- ZONE DE GRILLE --- */}
        <div className="dashboard-scroll-area" onDragOver={handleDragOver} onDrop={handleDrop} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div className="flexible-grid">
            {widgets.map((w) => (
              <div key={w.id} className="resizable-widget">
                <div className="widget-header">
                  <span className="widget-title-text">{w.title}</span>
                  <div className="widget-actions">
                    <button onClick={() => setZoomedWidget(w)} title="Zoomer"><Maximize2 size={12} /></button>
                    <button onClick={() => removeWidget(w.id)} className="close-x"><X size={12} /></button>
                  </div>
                </div>
                <div className="widget-content-wrapper">
                  <ChartRenderer chartType={w.config.type} result={w.result} config={w.config} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- OVERLAY ZOOM (Agrandissement) --- */}
        {zoomedWidget && (
          <div className="zoom-overlay">
            <div className="zoom-card">
              <div className="zoom-header">
                <h3>{zoomedWidget.title}</h3>
                <button onClick={() => setZoomedWidget(null)}><Minimize2 size={20} /> Fermer</button>
              </div>
              <div className="zoom-body">
                <ChartRenderer chartType={zoomedWidget.config.type} result={zoomedWidget.result} config={zoomedWidget.config} />
              </div>
            </div>
          </div>
        )}

      </main>

      <style>{`
        .btn-dash-primary { background: #0d5395; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
        .btn-dash-danger { background: white; color: #ef4444; border: 1px solid #fee2e2; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }

        .flexible-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }

        .resizable-widget {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            min-width: 300px;
            min-height: 250px;
            width: 400px; /* Taille par défaut */
            height: 300px;
            resize: both; /* FLEXIBILITÉ DE REDIMENSIONNEMENT */
            overflow: hidden; 
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            position: relative;
        }

        .widget-header {
            padding: 10px 15px;
            background: #fafafa;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }

        .widget-title-text { font-size: 11px; font-weight: 700; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .widget-actions { display: flex; gap: 8px; }
        .widget-actions button { background: none; border: none; color: #94a3b8; cursor: pointer; }
        .widget-actions button:hover { color: #0d5395; }
        .widget-actions .close-x:hover { color: #ef4444; }

        .widget-content-wrapper {
            flex: 1;
            padding: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: auto; /* Empêche le contenu d'être masqué */
        }

        /* ZOOM MODAL STYLES */
        .zoom-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.8); z-index: 9999;
            display: flex; align-items: center; justify-content: center; padding: 40px;
        }
        .zoom-card {
            background: white; width: 100%; max-width: 1000px; height: 80vh;
            border-radius: 20px; display: flex; flex-direction: column; overflow: hidden;
        }
        .zoom-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .zoom-header h3 { margin: 0; color: #0d5395; }
        .zoom-header button { background: #f1f5f9; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; }
        .zoom-body { flex: 1; padding: 40px; display: flex; align-items: center; justify-content: center; }
        .zoom-body svg { width: 100% !important; height: 400px !important; }

        /* Correction des graphiques internes */
        .widget-content-wrapper svg { width: 100% !important; max-height: 100%; }
        .widget-content-wrapper .mini-chart { width: 100%; }
      `}</style>
    </div>
  );
};

export default Dashboard;