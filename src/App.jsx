import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// Componentes
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute'; // <-- Nuestro Guardia

// Páginas
import Login from './pages/Login'; // <-- Nueva Pantalla
import Dashboard from './pages/Dashboard';
import Alumnos from './pages/Alumnos';
import Asistencia from './pages/Asistencia';
import Historial from './pages/Historial';
import RegistrarPagos from './pages/RegistrarPagos';
import VerPagos from './pages/VerPagos';
import DetalleAlumno from './pages/DetalleAlumno';

// === TRUCO PARA OCULTAR EL NAVBAR EN EL LOGIN ===
// Creamos un pequeño componente que envuelve todo el contenido
const AppContent = () => {
  const location = useLocation();
  // El Navbar se mostrará en todas partes EXCEPTO en la ruta '/login'
  const mostrarNavbar = location.pathname !== '/login';

  return (
    <div className="bg-light min-vh-100 hide-on-print">
      {mostrarNavbar && <Navbar />}
      
      <Routes>
        {/* RUTA PÚBLICA (Sin protección) */}
        <Route path="/login" element={<Login />} />

        {/* RUTAS PRIVADAS (Envueltas en ProtectedRoute) */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/alumnos" element={<ProtectedRoute><Alumnos /></ProtectedRoute>} /> 
        <Route path="/asistencia" element={<ProtectedRoute><Asistencia /></ProtectedRoute>} /> 
        <Route path="/historial" element={<ProtectedRoute><Historial /></ProtectedRoute>} />
        <Route path="/registrar-pago" element={<ProtectedRoute><RegistrarPagos /></ProtectedRoute>} />
        <Route path="/ver-pagos" element={<ProtectedRoute><VerPagos /></ProtectedRoute>} />
        <Route path="/perfil-alumno" element={<ProtectedRoute><DetalleAlumno /></ProtectedRoute>} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;