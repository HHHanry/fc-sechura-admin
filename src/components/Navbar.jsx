import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isOpen, setIsOpen] = useState(false);
  const navbarRef = useRef(null);

  // Cierra el menú al hacer clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && navbarRef.current && !navbarRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const cerrarMenu = () => setIsOpen(false);

  const handleLogout = () => {
    localStorage.removeItem('fc_sechura_auth');
    cerrarMenu();
    navigate('/login');
  };

  // Diseño de "Píldora" elegante para el enlace activo
  const activeClass = (path) => {
    return location.pathname === path 
      ? 'bg-white bg-opacity-25 fw-bold text-white opacity-100' 
      : 'text-white opacity-75 custom-hover';
  };

  return (
    <>
      <style>
        {`
          /* Efecto hover suave para los enlaces inactivos en PC */
          .custom-hover:hover {
            opacity: 1 !important;
            background-color: rgba(255, 255, 255, 0.1);
          }
          .nav-link {
            transition: all 0.3s ease;
          }
          /* Sombra sutil para el Navbar */
          .navbar-glass {
            background: linear-gradient(90deg, #1e3a8a 0%, #0d9488 100%);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          }
        `}
      </style>
      
      <nav 
        ref={navbarRef} 
        className="navbar navbar-expand-lg sticky-top hide-on-print navbar-glass" 
        style={{ padding: '0.8rem 0', zIndex: 1100 }}
      >
        <div className="container">
          
          {/* ==========================================
              1. ZONA IZQUIERDA: LOGO Y MARCA
              ========================================== */}
          <Link className="navbar-brand d-flex align-items-center" to="/" onClick={cerrarMenu}>
            <img src={logo} alt="Logo" style={{ width: '42px', height: '42px', objectFit: 'contain' }} className="me-2" />
            <span className="fw-bold text-white text-uppercase" style={{ letterSpacing: '1.2px', fontSize: '1.1rem' }}>
              FC Sechura
            </span>
          </Link>
          
          {/* HAMBURGUESA CUSTOM ANIMADA */}
          <button 
            className={`navbar-toggler ${isOpen ? '' : 'collapsed'}`} 
            type="button" 
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label="Toggle navigation"
            style={{ border: 'none', outline: 'none' }}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`collapse navbar-collapse ${isOpen ? 'show' : ''}`} style={{ transition: 'all 0.3s ease-in-out' }}>
            
            {/* ==========================================
                2. ZONA CENTRAL: ENLACES DE NAVEGACIÓN
                ========================================== */}
            <ul className="navbar-nav mx-auto align-items-center gap-1 gap-lg-2 my-3 my-lg-0">
              <li className="nav-item w-100 text-center text-lg-start">
                <Link className={`nav-link px-3 py-2 rounded-pill ${activeClass('/')}`} to="/" onClick={cerrarMenu}>Resumen</Link>
              </li>
              <li className="nav-item w-100 text-center text-lg-start">
                <Link className={`nav-link px-3 py-2 rounded-pill ${activeClass('/alumnos')}`} to="/alumnos" onClick={cerrarMenu}>Alumnos</Link>
              </li>
              <li className="nav-item w-100 text-center text-lg-start">
                <Link className={`nav-link px-3 py-2 rounded-pill ${activeClass('/asistencia')}`} to="/asistencia" onClick={cerrarMenu}>Scanner</Link>
              </li>
              <li className="nav-item w-100 text-center text-lg-start">
                <Link className={`nav-link px-3 py-2 rounded-pill ${activeClass('/historial')}`} to="/historial" onClick={cerrarMenu}>Asistencias</Link>
              </li>
              <li className="nav-item w-100 text-center text-lg-start">
                <Link className={`nav-link px-3 py-2 rounded-pill ${activeClass('/registrar-pago')}`} to="/registrar-pago" onClick={cerrarMenu}>Pagos</Link>
              </li>
              <li className="nav-item w-100 text-center text-lg-start">
                <Link className={`nav-link px-3 py-2 rounded-pill ${activeClass('/ver-pagos')}`} to="/ver-pagos" onClick={cerrarMenu}>Caja</Link>
              </li>
            </ul>

            {/* ==========================================
                3. ZONA DERECHA: PERFIL Y ACCIONES
                ========================================== */}
            {/* El border-top solo aparece en celular para separar el menú del perfil */}
            <div className="d-flex align-items-center justify-content-center gap-3 pb-3 pb-lg-0 pt-3 pt-lg-0 border-top border-light border-opacity-10 mt-2 mt-lg-0 border-lg-0">
              
              {/* Píldora de Perfil */}
              <div className="d-flex align-items-center bg-white bg-opacity-10 rounded-pill px-3 py-2 border border-white border-opacity-25 shadow-sm" style={{ backdropFilter: 'blur(5px)' }}>
                <i className="fas fa-user-circle text-info me-2 fs-5"></i>
                <span className="text-white small fw-bold">Pedro Silva</span>
              </div>
              
              {/* Botón Salir */}
              <button 
                onClick={handleLogout} 
                className="btn btn-danger rounded-circle shadow-sm d-flex align-items-center justify-content-center" 
                style={{ width: '42px', height: '42px', transition: 'all 0.2s' }}
                title="Cerrar Sesión"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>

          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;  