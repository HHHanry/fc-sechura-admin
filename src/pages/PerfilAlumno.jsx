import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// === IMPORTACIONES DE FIRESTORE ===
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const PerfilAlumno = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Recibimos los datos de manera segura
  const alumno = location.state?.alumno;

  const [historialAsistencia, setHistorialAsistencia] = useState([]);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [historialDeudas, setHistorialDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [tabActiva, setTabActiva] = useState('resumen');
  const [filtroMesAsistencia, setFiltroMesAsistencia] = useState('Todos');

  // === 1. CARGAR DATOS REALES DE FIREBASE ===
  useEffect(() => {
    const cargarExpediente = async () => {
      if (!alumno || !alumno.id) {
        setCargando(false);
        return;
      }
      
      setCargando(true);
      try {
        const getFirebaseTime = (obj) => (obj.createdAt && typeof obj.createdAt.toMillis === 'function') ? obj.createdAt.toMillis() : 0;

        // 1.1 Asistencias
        const qAsistencia = query(collection(db, 'asistencias'), where('alumnoId', '==', alumno.id));
        const asisSnap = await getDocs(qAsistencia);
        const asisList = asisSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        asisList.sort((a, b) => getFirebaseTime(b) - getFirebaseTime(a));
        setHistorialAsistencia(asisList);

        // 1.2 Pagos
        const qPagos = query(collection(db, 'pagos'), where('alumnoId', '==', alumno.id), where('estado', '==', 'Completado'));
        const pagosSnap = await getDocs(qPagos);
        const pagosList = pagosSnap.docs.map(d => ({ id: d.id, tipoRegistro: 'Pago', ...d.data() }));
        
        // 1.3 Deudas
        const qDeudas = query(collection(db, 'deudas'), where('alumnoId', '==', alumno.id));
        const deudasSnap = await getDocs(qDeudas);
        const deudasList = deudasSnap.docs.map(d => ({ id: d.id, tipoRegistro: 'Deuda', ...d.data() }));

        setHistorialPagos(pagosList);
        setHistorialDeudas(deudasList);

      } catch (error) { 
        console.error("Error de conexión con Firebase:", error); 
      } finally { 
        setCargando(false); 
      }
    };

    cargarExpediente();
  }, [alumno]);

  // === PANTALLA DE RESCATE (Evita la Pantalla Blanca si recargas con F5) ===
  if (!alumno || !alumno.id) {
    return (
      <div className="container py-5 text-center mt-5 animate__animated animate__fadeIn">
        <div className="bg-light rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4 shadow-sm" style={{width: '100px', height: '100px'}}>
          <i className="fas fa-user-times fa-3x text-muted opacity-50"></i>
        </div>
        <h2 className="fw-black text-dark">Sesión Caducada</h2>
        <p className="text-muted fs-5">Has recargado la página y los datos del alumno se borraron por seguridad.</p>
        <button className="btn btn-lg btn-turquesa text-white fw-bold px-5 mt-3 rounded-pill shadow" onClick={() => navigate('/alumnos')}>
          <i className="fas fa-arrow-left me-2"></i> Volver a Lista de Alumnos
        </button>
      </div>
    );
  }

  // === VARIABLES SEGURAS ===
  const inicialNombre = (alumno.nombre || 'U').charAt(0).toUpperCase();
  const inicialApellido = (alumno.apellido || 'U').charAt(0).toUpperCase();

  const d = new Date();
  const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const vencimiento = alumno.vencimientoMensualidad || '2000-01-01';
  const debeMes = hoyLocal >= vencimiento;
  
  let diasAtraso = 0;
  try {
    const vDate = new Date(vencimiento);
    if (!isNaN(vDate.getTime())) {
      const diffTime = Math.abs(new Date() - vDate);
      diasAtraso = debeMes ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
    }
  } catch (e) { diasAtraso = 0; }

  const deudasActivas = historialDeudas.filter(d => d.estado === 'Pendiente');
  const totalDeudasExtras = deudasActivas.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
  const estaMoroso = debeMes || totalDeudasExtras > 0;
  
  const totalInvertidoHistorico = historialPagos.reduce((sum, p) => sum + (Number(p.total) || Number(p.monto) || 0), 0);

  const asistenciaFiltrada = historialAsistencia.filter(registro => {
    if (filtroMesAsistencia === 'Todos') return true;
    const mesAnioRegistro = registro.fecha ? String(registro.fecha).substring(3) : '';
    return mesAnioRegistro === filtroMesAsistencia;
  });
  
  const totalClases = asistenciaFiltrada.length;
  const asistenciasCount = asistenciaFiltrada.filter(a => a.estado === 'Asistió' || a.estado === 'Tarde').length;
  const porcentajeAsistencia = totalClases === 0 ? 0 : Math.round((asistenciasCount / totalClases) * 100);

  const lineaTiempoFinanciera = [...historialPagos, ...historialDeudas].sort((a, b) => {
    const getTime = (obj) => (obj.createdAt && typeof obj.createdAt.toMillis === 'function') ? obj.createdAt.toMillis() : 0;
    return getTime(b) - getTime(a);
  });

  // === IMPRESIÓN PDF ===
  const imprimirBloque = (titulo, idContenedor, esHorizontal = false) => {
    const el = document.getElementById(idContenedor);
    if (!el) return;
    const contenidoHTML = el.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html><head><title>${titulo}</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        @page { size: ${esHorizontal ? 'A4 landscape' : 'A4 portrait'}; margin: 15mm; }
        body { background: white !important; font-family: system-ui, sans-serif; padding: 20px; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .btn-no-print, .form-select { display: none !important; }
        .table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 12px; }
        .table th { border-bottom: 2px solid #1e3a8a; padding: 8px; text-transform: uppercase; background: #f8fafc !important; }
        .table td { border-bottom: 1px solid #e2e8f0; padding: 8px; }
        .text-azul { color: #1e3a8a !important; } .text-success { color: #10b981 !important; } .text-danger { color: #ef4444 !important; }
        .header-print { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
      </style></head>
      <body>
        <div class="header-print">
          <div><h2 style="margin:0; color:#1e3a8a; font-weight:900;">FC SECHURA</h2><p style="margin:0; font-size:12px; color:#64748b;">${titulo}</p></div>
          <div style="text-align:right;"><h4 style="margin:0;">${alumno.nombre} ${alumno.apellido}</h4><p style="margin:0; font-size:12px; color:#64748b;">DNI: ${alumno.dni} | Cat. ${alumno.categoria}</p></div>
        </div>
        ${contenidoHTML}
      </body></html>
    `);
    doc.close(); iframe.contentWindow.focus();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => { document.body.removeChild(iframe); }, 1000); }, 800);
  };

  return (
    <div className="container py-4 mb-5 animate__animated animate__fadeIn">
      
      <div className="d-flex justify-content-between align-items-center mb-4 btn-no-print">
        <button className="btn btn-light shadow-sm border fw-bold text-secondary rounded-pill px-4" onClick={() => navigate('/alumnos')}>
          <i className="fas fa-arrow-left me-2"></i> Volver a Lista
        </button>
        <button className="btn btn-danger fw-bold rounded-pill shadow-sm px-4" onClick={() => navigate('/caja')}>
          <i className="fas fa-cash-register me-2"></i> Ir a Caja
        </button>
      </div>

      <div className="row g-4">
        {/* === COLUMNA IZQ: PERFIL === */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden mb-4">
            <div className="bg-azul p-4 text-center position-relative" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' }}>
              {alumno.foto ? (
                <img src={alumno.foto} alt="Perfil" className="rounded-circle border border-4 border-white shadow-lg" style={{ width: '120px', height: '120px', objectFit: 'cover' }} />
              ) : (
                <div className="rounded-circle bg-light text-azul d-flex align-items-center justify-content-center mx-auto border border-4 border-white shadow-lg" style={{ width: '120px', height: '120px', fontSize: '3rem', fontWeight: '900' }}>
                  {inicialNombre}{inicialApellido}
                </div>
              )}
            </div>
            <div className="card-body p-4 text-center pt-2">
              <h4 className="fw-black text-dark mb-0">{alumno.nombre} {alumno.apellido}</h4>
              <p className="text-muted mb-3">DNI: {alumno.dni}</p>
              <div className="d-flex justify-content-center gap-2 mb-4">
                <span className="badge bg-celeste text-azul rounded-pill px-3 py-2 fs-6">Cat. {alumno.categoria}</span>
                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 fs-6">{alumno.edad || '-'} años</span>
              </div>
              <div className="bg-light rounded-3 p-3 text-start mb-3 border">
                <div className="small text-muted fw-bold text-uppercase mb-1"><i className="fas fa-user-shield me-2"></i>Apoderado</div>
                <div className="fw-black text-dark mb-2">{alumno.apoderado || 'No registrado'}</div>
                <div className="small text-muted fw-bold text-uppercase mb-1"><i className="fas fa-phone-alt me-2 text-success"></i>Celular</div>
                <div className="fw-bold text-dark">{alumno.celular || 'No registrado'}</div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4 border-start border-4 border-info">
            <div className="card-body p-3 d-flex align-items-center">
              <div className="bg-info bg-opacity-10 text-info rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
                <i className="fas fa-medal fs-5"></i>
              </div>
              <div>
                <span className="text-muted small fw-bold text-uppercase">Miembro desde</span>
                <h5 className="fw-black text-dark mb-0">{alumno.fechaInscripcion || 'Sin registro'}</h5>
              </div>
            </div>
          </div>
        </div>

        {/* === COLUMNA DER: DASHBOARD === */}
        <div className="col-lg-8">
          <ul className="nav nav-pills mb-4 bg-white p-2 rounded-pill shadow-sm border btn-no-print d-flex">
            <li className="nav-item flex-fill text-center">
              <button className={`nav-link w-100 rounded-pill fw-bold ${tabActiva === 'resumen' ? 'active bg-azul text-white' : 'text-secondary'}`} onClick={() => setTabActiva('resumen')} style={{ backgroundColor: tabActiva === 'resumen' ? '#1e3a8a' : 'transparent' }}>
                <i className="fas fa-chart-pie me-2"></i> Estado Financiero
              </button>
            </li>
            <li className="nav-item flex-fill text-center">
              <button className={`nav-link w-100 rounded-pill fw-bold ${tabActiva === 'historial' ? 'active bg-azul text-white' : 'text-secondary'}`} onClick={() => setTabActiva('historial')} style={{ backgroundColor: tabActiva === 'historial' ? '#1e3a8a' : 'transparent' }}>
                <i className="fas fa-list-alt me-2"></i> Pagos / Deudas
              </button>
            </li>
            <li className="nav-item flex-fill text-center">
              <button className={`nav-link w-100 rounded-pill fw-bold ${tabActiva === 'asistencia' ? 'active bg-azul text-white' : 'text-secondary'}`} onClick={() => setTabActiva('asistencia')} style={{ backgroundColor: tabActiva === 'asistencia' ? '#1e3a8a' : 'transparent' }}>
                <i className="fas fa-calendar-check me-2"></i> Asistencias
              </button>
            </li>
          </ul>

          <div className="tab-content">
            
            {/* FINANZAS */}
            <div className={`tab-pane fade ${tabActiva === 'resumen' ? 'show active' : ''}`}>
              <div className={`card border-0 shadow-sm rounded-4 mb-4 ${estaMoroso ? 'bg-danger bg-opacity-10 border-danger' : 'bg-success bg-opacity-10 border-success'} border`}>
                <div className="card-body p-4 p-md-5 text-center">
                  <i className={`fas ${estaMoroso ? 'fa-exclamation-triangle text-danger' : 'fa-check-circle text-success'} fa-4x mb-3`}></i>
                  <h2 className={`fw-black ${estaMoroso ? 'text-danger' : 'text-success'}`}>
                    {estaMoroso ? 'ALUMNO CON DEUDA' : 'ALUMNO AL DÍA'}
                  </h2>
                  <p className="text-muted fw-medium fs-5 mb-0">
                    {estaMoroso && debeMes ? `Mensualidad vencida hace ${diasAtraso} días (${alumno.vencimientoMensualidad}).` : (estaMoroso ? 'La mensualidad está al día, pero existen deudas extra.' : `Próximo vencimiento mensual: ${alumno.vencimientoMensualidad || 'Sin Fecha'}`)}
                  </p>
                </div>
              </div>

              {estaMoroso && (
                <div className="row g-3 mb-4">
                  {debeMes && (
                    <div className="col-md-6">
                      <div className="card border-0 shadow-sm rounded-3 bg-white border-start border-4 border-danger h-100 p-3">
                        <div className="small fw-bold text-muted text-uppercase mb-2"><i className="fas fa-calendar-times text-danger me-2"></i>Mensualidad</div>
                        <h4 className="fw-black text-dark mb-0">VENCIDA</h4>
                        <div className="small text-danger fw-bold mt-1">Desde el {alumno.vencimientoMensualidad}</div>
                      </div>
                    </div>
                  )}
                  {totalDeudasExtras > 0 && (
                    <div className="col-md-6">
                      <div className="card border-0 shadow-sm rounded-3 bg-white border-start border-4 border-warning h-100 p-3">
                        <div className="small fw-bold text-muted text-uppercase mb-2"><i className="fas fa-shopping-basket text-warning me-2"></i>Cargos Extras</div>
                        <h4 className="fw-black text-dark mb-0">S/. {totalDeudasExtras.toFixed(2)}</h4>
                        <div className="small text-muted mt-1">{deudasActivas.length} item(s) pendiente(s)</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="card border-0 shadow-sm rounded-4 p-4 text-center">
                <p className="small text-muted fw-bold text-uppercase mb-1">Valor Histórico del Alumno (LTV)</p>
                <h1 className="fw-black text-azul mb-0">S/. {totalInvertidoHistorico.toFixed(2)}</h1>
              </div>
            </div>

            {/* KÁRDEX PAGOS */}
            <div className={`tab-pane fade ${tabActiva === 'historial' ? 'show active' : ''}`}>
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center btn-no-print">
                  <h6 className="fw-bold mb-0 text-secondary"><i className="fas fa-receipt text-turquesa me-2"></i>Movimientos</h6>
                  <button className="btn btn-sm btn-outline-danger fw-bold rounded-pill" onClick={() => imprimirBloque('Estado de Cuenta y Transacciones', 'area-impresion-kardex')}>
                    <i className="fas fa-file-pdf me-1"></i> PDF
                  </button>
                </div>
                <div className="card-body p-0" id="area-impresion-kardex">
                  <div className="table-responsive" style={{ maxHeight: '400px' }}>
                    <table className="table table-hover align-middle mb-0">
                      <thead className="bg-light sticky-top">
                        <tr>
                          <th className="py-3 ps-4 small fw-bold text-muted">Fecha</th>
                          <th className="py-3 small fw-bold text-muted">Tipo</th>
                          <th className="py-3 small fw-bold text-muted">Concepto</th>
                          <th className="py-3 small fw-bold text-muted text-end">Monto</th>
                          <th className="py-3 pe-4 small fw-bold text-muted text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineaTiempoFinanciera.length === 0 ? (
                          <tr><td colSpan="5" className="text-center py-5 text-muted">No hay movimientos.</td></tr>
                        ) : (
                          lineaTiempoFinanciera.map(mov => {
                            const esPago = mov.tipoRegistro === 'Pago';
                            return (
                              <tr key={mov.id}>
                                <td className="ps-4 text-muted small">{mov.fecha || mov.fechaGeneracion || mov.fechaPago}</td>
                                <td>
                                  <span className={`badge ${esPago ? 'bg-success bg-opacity-10 text-success border-success' : 'bg-danger bg-opacity-10 text-danger border-danger'} border rounded-pill px-2 py-1`}>
                                    {esPago ? 'Ingreso' : 'Cargo / Deuda'}
                                  </span>
                                </td>
                                <td className="fw-medium text-dark" style={{ fontSize: '13px' }}>{mov.conceptoResumen || mov.concepto}</td>
                                <td className={`text-end fw-black ${esPago ? 'text-success' : 'text-danger'}`}>
                                  {esPago ? '+' : '-'} S/. {(Number(mov.total) || Number(mov.monto) || 0).toFixed(2)}
                                </td>
                                <td className="pe-4 text-center">
                                  <span className={`small fw-bold ${mov.estado === 'Completado' || mov.estado === 'Pagado' ? 'text-success' : 'text-warning'}`}>{mov.estado}</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* ASISTENCIAS */}
            <div className={`tab-pane fade ${tabActiva === 'asistencia' ? 'show active' : ''}`}>
              <div className="row g-3 mb-4 btn-no-print">
                <div className="col-4"><div className="bg-success bg-opacity-10 text-success p-3 rounded-3 text-center border border-success border-opacity-25"><h3 className="fw-black mb-0">{porcentajeAsistencia}%</h3><small className="fw-bold">Asistencia</small></div></div>
                <div className="col-4"><div className="bg-warning bg-opacity-10 text-warning p-3 rounded-3 text-center border border-warning border-opacity-25"><h3 className="fw-black mb-0">{totalTardanzas}</h3><small className="fw-bold">Tardanzas</small></div></div>
                <div className="col-4"><div className="bg-danger bg-opacity-10 text-danger p-3 rounded-3 text-center border border-danger border-opacity-25"><h3 className="fw-black mb-0">{totalFaltas}</h3><small className="fw-bold">Faltas</small></div></div>
              </div>

              <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center btn-no-print">
                  <select className="form-select form-select-sm w-auto border-2 fw-bold text-azul bg-light shadow-sm" value={filtroMesAsistencia} onChange={(e) => setFiltroMesAsistencia(e.target.value)}>
                    <option value="Todos">Todo el Historial</option>
                    <option value="05/2026">Mayo 2026</option>
                    <option value="04/2026">Abril 2026</option>
                    <option value="03/2026">Marzo 2026</option>
                  </select>
                  <button className="btn btn-sm btn-outline-danger fw-bold rounded-pill" onClick={() => imprimirBloque(`Kárdex de Asistencia (${filtroMesAsistencia})`, 'area-impresion-asistencia')}>
                    <i className="fas fa-file-pdf me-1"></i> PDF
                  </button>
                </div>
                
                <div className="card-body p-0" id="area-impresion-asistencia">
                  <div className="table-responsive" style={{ maxHeight: '400px' }}>
                    <table className="table table-hover align-middle mb-0 text-center">
                      <thead className="bg-light sticky-top">
                        <tr>
                          <th className="py-2 text-muted small fw-bold text-uppercase">Fecha</th>
                          <th className="py-2 text-muted small fw-bold text-uppercase">Ingreso</th>
                          <th className="py-2 text-muted small fw-bold text-uppercase">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargando ? (
                          <tr><td colSpan="3" className="py-5"><div className="spinner-border text-primary"></div></td></tr>
                        ) : asistenciaFiltrada.length === 0 ? (
                          <tr><td colSpan="3" className="py-5 text-muted">No hay registros en este periodo.</td></tr>
                        ) : (
                          asistenciaFiltrada.map(a => (
                            <tr key={a.id}>
                              <td className="fw-bold text-dark">{a.fecha}</td>
                              <td className="font-monospace text-muted">{a.horaIngreso || '-'}</td>
                              <td><span className={`badge rounded-pill px-3 py-1 ${a.estado === 'Asistió' ? 'bg-success' : a.estado === 'Tarde' ? 'bg-warning text-dark' : 'bg-danger'}`}>{a.estado}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfilAlumno;