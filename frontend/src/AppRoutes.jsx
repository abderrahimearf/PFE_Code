import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import Dashboard from './pages/Dashboard'; // Import de la page Dashboard
import PartagePage from './pages/PartagePage';       // Import de la page Report
import ReportPage from './pages/ReportPage';
const AppRoutes = () => {
  return (
    <Routes>
      {/* Route principale (Chat) */}
      <Route path="/" element={<ChatPage />} />
      
      {/* Discussion spécifique via ID */}
      <Route path="/chat/:id" element={<ChatPage />} />
      
      {/* Nouvelle route pour le Dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reportpage" element={<ReportPage />} />
      {/* Nouvelle route pour les Rapports */}
      <Route path="/PartagePage" element={<PartagePage />} />

      {/* Optionnel : Redirection si la page n'existe pas */}
      <Route path="*" element={<ChatPage />} />
    </Routes>
  );
};

export default AppRoutes;