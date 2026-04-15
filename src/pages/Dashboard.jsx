import React, { useState, useEffect } from 'react';
import imagenPortada from '../assets/dashboard-cover.jpg';

// === IMPORTACIONES DE FIREBASE ===
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const Dashboard = () => {
  // === ESTADOS PARA LOS KPIs REALES ===
  const [stats, setStats] = useState({
    totalAlumnos: 0,
    asistenciaPorcentaje: 0,
    pagosPendientes: 0,
    totalCategorias: 7 // Valor por defecto
  });
  const [cargando, setCargando] = useState(true);

  // Fecha actual para calcular la asistencia de hoy
  const ahora = new Date();
  const dia = ahora.getDate().toString().padStart(2, '0');
  const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
  const anio = ahora.getFullYear();
  const fechaHoy = `${dia}/${mes}/${anio}`;

  useEffect(() => {
    const cargarDatosReales = async () => {
      try {
        // 1. OBTENER TOTAL DE ALUMNOS Y CATEGORÍAS ÚNICAS
        const alumnosSnapshot = await getDocs(collection(db, 'alumnos'));
        const totalAlumnos = alumnosSnapshot.size;
        
        // Extraemos las categorías y usamos un Set para contar las únicas
        const categoriasUnicas = new Set();
        alumnosSnapshot.forEach(doc => {
          if (doc.data().categoria) categoriasUnicas.add(doc.data().categoria);
        });
        const numeroCategorias = categoriasUnicas.size > 0 ? categoriasUnicas.size : 7;

        // 2. OBTENER ASISTENCIA DE HOY PARA EL PORCENTAJE
        const qAsistencias = query(
          collection(db, 'asistencias'),
          where('fecha', '==', fechaHoy)
        );
        const asistenciasSnapshot = await getDocs(qAsistencias);
        
        let presentesHoy = 0;
        asistenciasSnapshot.forEach(doc => {
          if (doc.data().estado !== 'Faltó') presentesHoy++;
        });

        // Calculamos el porcentaje (evitando dividir por 0)
        const porcentaje = totalAlumnos > 0 ? Math.round((presentesHoy / totalAlumnos) * 100) : 0;

        // 3. OBTENER PAGOS PENDIENTES (Dejamos la consulta lista para el módulo de Finanzas)
        let pendientesCount = 0;
        try {
          const qPagos = query(collection(db, 'pagos'), where('estado', '==', 'Pendiente'));
          const pagosSnapshot = await getDocs(qPagos);
          pendientesCount = pagosSnapshot.size;
        } catch (e) {
          // Si la colección 'pagos' aún no existe, no rompemos la app
          console.log("Colección de pagos aún no inicializada.");
        }

        // 4. ACTUALIZAR ESTADO
        setStats({
          totalAlumnos: totalAlumnos,
          asistenciaPorcentaje: porcentaje,
          pagosPendientes: pendientesCount,
          totalCategorias: numeroCategorias
        });

      } catch (error) {
        console.error("Error al cargar KPIs del Dashboard:", error);
      } finally {
        setCargando(false);
      }
    };

    cargarDatosReales();
  }, [fechaHoy]);

  return (
    <div className="container py-5">
      
      {/* 1. PORTADA IMPACTANTE */}
      <div className="dashboard-hero animate__animated animate__fadeIn position-relative rounded-4 overflow-hidden mb-5" style={{ height: '300px', backgroundImage: `url(${imagenPortada})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Capa oscura para que el texto resalte si decides poner texto encima */}
        <div className="position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"></div>
        <div className="hero-content px-3 position-relative z-index-1 h-100 d-flex align-items-center">
          {/* El contenido de tu hero va aquí */}
        </div>
      </div>

      {/* 2. INFORMACIÓN Y SLOGAN */}
      <div className="row g-4 mb-5 align-items-center">
        <div className="col-lg-7">
          <h2 className="fw-bold mb-3" style={{ color: 'var(--fc-azul)' }}>Sobre el Sistema</h2>
          <p className="text-muted fs-5 leading-relaxed">
            Esta plataforma ha sido diseñada exclusivamente para centralizar el control operativo de la academia. 
            Desde aquí, podrás gestionar el ciclo de vida completo de nuestros atletas: desde su inscripción y 
            perfil deportivo, hasta el monitoreo preciso de su asistencia y el orden financiero de sus pagos.
          </p>
          <p className="text-muted fs-5">
            Nuestro objetivo es que la tecnología sea el mejor aliado del profesor para que él se enfoque 
            en lo que mejor sabe hacer: <strong>formar las estrellas del mañana.</strong>
          </p>
        </div>
        <div className="col-lg-5">
          <div className="slogan-box shadow-sm p-4 rounded-4 bg-white border-start border-4 border-info">
            <i className="fas fa-quote-left text-turquesa fs-1 mb-3 opacity-50"></i>
            <h3 className="fw-bold mb-0" style={{ color: 'var(--fc-azul)' }}>"Nuestra pasión marca la diferencia"</h3>
            <p className="text-end mb-0 mt-2 text-muted small fw-bold">— FC Sechura Oficial</p>
          </div>
        </div>
      </div>

      {/* 3. RESÚMENES PEQUEÑOS (KPIs) CON DATOS DE FIREBASE */}
      <div className="row g-4">
        <h4 className="fw-bold mb-2 text-secondary text-uppercase small tracking-wider">Vista Rápida de Hoy</h4>
        
        {/* Card: Alumnos */}
        <div className="col-md-3">
          <div className="card kpi-card shadow-sm h-100 bg-white border-0 rounded-4">
            <div className="card-body p-4 text-center">
              <div className="bg-azul bg-opacity-10 text-azul rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{width: '60px', height: '60px'}}>
                <i className="fas fa-users fs-4"></i>
              </div>
              <h6 className="text-muted fw-bold text-uppercase small">Alumnos</h6>
              <h2 className="display-6 fw-bold mb-0">
                {cargando ? <span className="spinner-border spinner-border-sm text-primary"></span> : stats.totalAlumnos}
              </h2>
              <div className="text-success small mt-2 fw-medium">
                <i className="fas fa-database me-1"></i> Registros en Nube
              </div>
            </div>
          </div>
        </div>

        {/* Card: Asistencia */}
        <div className="col-md-3">
          <div className="card kpi-card shadow-sm h-100 bg-white border-0 rounded-4">
            <div className="card-body p-4 text-center">
              <div className="bg-turquesa bg-opacity-10 text-turquesa rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{width: '60px', height: '60px'}}>
                <i className="fas fa-calendar-check fs-4"></i>
              </div>
              <h6 className="text-muted fw-bold text-uppercase small">Asistencia Hoy</h6>
              <h2 className="display-6 fw-bold mb-0">
                {cargando ? <span className="spinner-border spinner-border-sm text-info"></span> : `${stats.asistenciaPorcentaje}%`}
              </h2>
              <div className="text-muted small mt-2 fw-medium">Del total de alumnos</div>
            </div>
          </div>
        </div>

        {/* Card: Pagos */}
        <div className="col-md-3">
          <div className="card kpi-card shadow-sm h-100 bg-white border-0 rounded-4">
            <div className="card-body p-4 text-center">
              <div className="bg-warning bg-opacity-10 text-warning rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{width: '60px', height: '60px'}}>
                <i className="fas fa-hand-holding-usd fs-4"></i>
              </div>
              <h6 className="text-muted fw-bold text-uppercase small">Pagos Pendientes</h6>
              <h2 className="display-6 fw-bold mb-0 text-danger">
                {cargando ? <span className="spinner-border spinner-border-sm text-warning"></span> : stats.pagosPendientes}
              </h2>
              <div className="text-danger small mt-2 fw-medium">Requieren atención</div>
            </div>
          </div>
        </div>

        {/* Card: Categorías */}
        <div className="col-md-3">
          <div className="card kpi-card shadow-sm h-100 bg-white border-0 rounded-4">
            <div className="card-body p-4 text-center">
              <div className="bg-celeste bg-opacity-20 text-azul rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{width: '60px', height: '60px'}}>
                <i className="fas fa-trophy fs-4"></i>
              </div>
              <h6 className="text-muted fw-bold text-uppercase small">Categorías</h6>
              <h2 className="display-6 fw-bold mb-0">
                {cargando ? <span className="spinner-border spinner-border-sm text-primary"></span> : stats.totalCategorias}
              </h2>
              <div className="text-muted small mt-2 fw-medium">Activas en el sistema</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;