import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from "firebase/auth"; 
import { auth } from "../firebase"; 
import logo from '../assets/logo.png';

const Login = () => {
  const [credenciales, setCredenciales] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setCredenciales({ ...credenciales, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      await signInWithEmailAndPassword(auth, credenciales.email, credenciales.password);
      navigate('/'); 
    } catch (err) {
      console.error(err.code);
      if (err.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError('Ocurrió un error al conectar con el servidor.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    // Agregué p-3 para que en celular la tarjeta no pegue con los bordes de la pantalla
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ backgroundColor: '#f8fafc' }}>
      <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ maxWidth: '900px', width: '100%' }}>
        <div className="row g-0">
          
          {/* === LADO IZQUIERDO: DISEÑO PC (Se oculta en celulares) === */}
          <div className="col-md-6 d-none d-md-flex flex-column align-items-center justify-content-center p-5" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' }}>
            <img src={logo} alt="FC Sechura" style={{ width: '160px', marginBottom: '20px' }} />
            <h2 className="fw-black text-white mb-2 tracking-tight text-center display-6">FC SECHURA</h2>
            <p className="text-info fw-bold text-center tracking-wider text-uppercase small">Gestión Administrativa Real</p>
          </div>

          {/* === LADO DERECHO: FORMULARIO === */}
          <div className="col-md-6 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
            
            {/* === DISEÑO EXCLUSIVO PARA MÓVILES (Se oculta en PC) === */}
            <div className="d-md-none text-center mb-4 pb-3 border-bottom">
              <div className="rounded-circle d-inline-flex align-items-center justify-content-center p-3 mb-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' }}>
                <img src={logo} alt="FC Sechura" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
              </div>
              <h2 className="fw-black tracking-tight mb-0" style={{ color: '#1e3a8a' }}>FC SECHURA</h2>
              <p className="text-muted small fw-bold text-uppercase tracking-wider mb-0 mt-1">Panel Administrativo</p>
            </div>

            <div className="text-center text-md-start">
              <h4 className="fw-bold text-dark mb-1">Acceso Seguro</h4>
              <p className="text-muted small mb-4">Ingresa tus credenciales oficiales para continuar.</p>
            </div>

            {error && <div className="alert alert-danger py-2 small fw-bold text-center border-0 animate__animated animate__shakeX">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-secondary">Correo Electrónico</label>
                <div className="input-group shadow-sm rounded-3 overflow-hidden">
                  <span className="input-group-text bg-light border-0"><i className="fas fa-envelope text-muted"></i></span>
                  <input type="email" className="form-control border-0 bg-light py-2 shadow-none" name="email" value={credenciales.email} onChange={handleChange} required placeholder="admin@fcsechura.com" />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="form-label small fw-bold text-secondary">Contraseña</label>
                <div className="input-group shadow-sm rounded-3 overflow-hidden">
                  <span className="input-group-text bg-light border-0"><i className="fas fa-lock text-muted"></i></span>
                  <input type="password" className="form-control border-0 bg-light py-2 shadow-none" name="password" value={credenciales.password} onChange={handleChange} required placeholder="••••••••" />
                </div>
              </div>

              <button type="submit" disabled={cargando} className="btn btn-lg w-100 fw-bold text-white rounded-pill shadow mt-2" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' }}>
                {cargando ? <span className="spinner-border spinner-border-sm me-2"></span> : <><i className="fas fa-sign-in-alt me-2"></i> Entrar al Sistema</>}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;