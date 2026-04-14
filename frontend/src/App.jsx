import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './AppRoutes'; // Importation de tes routes
import './App.css'; // Tes styles globaux

function App() {
  return (
    <Router>
      {/* On enveloppe tout dans le Router pour permettre la navigation */}
      <div className="app-entry">
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;