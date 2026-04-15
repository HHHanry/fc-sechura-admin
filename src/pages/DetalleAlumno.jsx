import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png'; 
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const DetalleAlumno = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const alumno = location.state?.alumno;

  const [historialAsistencia, setHistorialAsistencia] = useState([]);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [historialDeudas, setHistorialDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [tabActiva, setTabActiva] = useState('general');
  const [filtroMesAsistencia, setFiltroMesAsistencia] = useState('Todos');

  const [editandoMedico, setEditandoMedico] = useState(false);
  const [guardandoMedico, setGuardandoMedico] = useState(false);
  const [datosMedicos, setDatosMedicos] = useState({
    tipoSangre: 'No especificado',
    alergias: '',
    lesionesPrevias: '',
    seguro: ''
  });

  useEffect(() => {
    const cargarExpediente = async () => {
      if (!alumno || !alumno.id) {
        setCargando(false);
        return;
      }
      
      setCargando(true);
      try {
        const getSafeTime = (obj) => (obj && obj.createdAt && typeof obj.createdAt.toMillis === 'function') ? obj.createdAt.toMillis() : 0;

        const qAsistencia = query(collection(db, 'asistencias'), where('alumnoId', '==', alumno.id));
        const asisSnap = await getDocs(qAsistencia);
        const asisList = asisSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        asisList.sort((a, b) => getSafeTime(b) - getSafeTime(a));
        setHistorialAsistencia(asisList);

        const qPagos = query(collection(db, 'pagos'), where('alumnoId', '==', alumno.id), where('estado', '==', 'Completado'));
        const pagosSnap = await getDocs(qPagos);
        const pagosList = pagosSnap.docs.map(d => ({ id: d.id, tipoRegistro: 'Pago', ...d.data() }));
        
        const qDeudas = query(collection(db, 'deudas'), where('alumnoId', '==', alumno.id));
        const deudasSnap = await getDocs(qDeudas);
        const deudasList = deudasSnap.docs.map(d => ({ id: d.id, tipoRegistro: 'Deuda', ...d.data() }));

        setHistorialPagos(pagosList);
        setHistorialDeudas(deudasList);

        if (alumno.medico) {
          setDatosMedicos(alumno.medico);
        }

      } catch (error) {
        console.error("Error al cargar datos:", error);
      } finally {
        setCargando(false);
      }
    };

    cargarExpediente();
  }, [alumno]);

  const handleMedicoChange = (e) => {
    setDatosMedicos({ ...datosMedicos, [e.target.name]: e.target.value });
  };

  const guardarFichaMedica = async () => {
    setGuardandoMedico(true);
    try {
      const alumnoRef = doc(db, 'alumnos', alumno.id);
      await updateDoc(alumnoRef, { medico: datosMedicos });
      alumno.medico = datosMedicos; 
      setEditandoMedico(false);
      alert("Ficha Médica de Emergencia actualizada.");
    } catch (error) {
      alert("Error al guardar los datos médicos en la nube.");
      console.error(error);
    } finally {
      setGuardandoMedico(false);
    }
  };

  if (!alumno || !alumno.id) {
    return (
      <div className="container py-5 text-center mt-5">
        <i className="fas fa-exclamation-circle fa-4x text-muted mb-3 opacity-50"></i>
        <h3 className="fw-bold text-dark">Sesión no encontrada</h3>
        <p className="text-muted">Los datos temporales se limpiaron por seguridad. Vuelve a la lista de alumnos.</p>
        <button className="btn btn-primary fw-bold px-4 rounded-pill mt-2 shadow-sm" onClick={() => navigate('/alumnos')}>
          Regresar a Alumnos
        </button>
      </div>
    );
  }

  const nombreSeguro = String(alumno.nombre || 'Usuario');
  const apellidoSeguro = String(alumno.apellido || '');
  const iniciales = `${nombreSeguro.charAt(0)}${apellidoSeguro.charAt(0) || ''}`.toUpperCase();
  
  const celularSeguro = String(alumno.celular || '');
  const numeroLimpio = celularSeguro.replace(/\D/g, '');
  const linkWhatsApp = numeroLimpio.length >= 9 ? `https://wa.me/51${numeroLimpio}` : null;

  const hoyLocal = new Date().toISOString().split('T')[0];
  const vencimiento = String(alumno.vencimientoMensualidad || '2000-01-01');
  const debeMes = hoyLocal >= vencimiento;

  let diasAtraso = 0;
  try {
    const vDate = new Date(vencimiento);
    if (!isNaN(vDate.getTime())) {
      const diffTime = Math.abs(new Date() - vDate);
      diasAtraso = debeMes ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
    }
  } catch (e) { diasAtraso = 0; }

  const deudasPendientes = historialDeudas.filter(d => d.estado === 'Pendiente');
  const totalDeudasExtras = deudasPendientes.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
  const estaMoroso = debeMes || totalDeudasExtras > 0;

  const totalPagado = historialPagos.reduce((sum, p) => sum + (Number(p.total) || Number(p.monto) || 0), 0);
  
  // === CORRECCIÓN FINANCIERA V1: La deuda base ahora es S/ 65 ===
  const deudaTotal = (debeMes ? 65 : 0) + totalDeudasExtras;
  const totalFacturadoHistorico = totalPagado + deudaTotal;
  const porcentajeCumplimiento = totalFacturadoHistorico === 0 ? 100 : Math.round((totalPagado / totalFacturadoHistorico) * 100);

  const lineaTiempoFinanciera = [...historialPagos, ...historialDeudas].sort((a, b) => {
    const timeA = (a.createdAt && typeof a.createdAt.toMillis === 'function') ? a.createdAt.toMillis() : 0;
    const timeB = (b.createdAt && typeof b.createdAt.toMillis === 'function') ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });

  const asistenciaFiltrada = historialAsistencia.filter(registro => {
    if (filtroMesAsistencia === 'Todos') return true;
    return registro?.fecha && String(registro.fecha).includes(filtroMesAsistencia);
  });
  const totalClases = asistenciaFiltrada.length;
  const asistenciasCount = asistenciaFiltrada.filter(a => a.estado === 'Asistió').length;
  const tardanzasCount = asistenciaFiltrada.filter(a => a.estado === 'Tarde').length;
  const faltasCount = asistenciaFiltrada.filter(a => a.estado === 'Faltó').length;
  const porcentajeAsistencia = totalClases === 0 ? 0 : Math.round(((asistenciasCount + tardanzasCount) / totalClases) * 100);

  const imprimirReporte = (idContenedor, tituloReporte) => {
    const el = document.getElementById(idContenedor);
    if (!el) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html><head><title>${tituloReporte}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body{padding: 30px; font-family: system-ui, sans-serif;} 
        .btn-no-print{display:none !important;}
        .card { border: none !important; box-shadow: none !important; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th { border-bottom: 2px solid #000; padding: 8px; text-transform: uppercase; }
        td { border-bottom: 1px solid #ccc; padding: 8px; }
      </style>
      </head><body>
        <div style="border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="color: #1e3a8a; font-weight: 900; margin: 0;">FC SECHURA</h2>
            <p style="margin: 0; color: #6c757d; font-weight: bold; text-transform: uppercase;">${tituloReporte}</p>
          </div>
          <div style="text-align: right;">
            <h4 style="margin: 0;">${nombreSeguro} ${apellidoSeguro}</h4>
            <p style="margin: 0; color: #6c757d; font-size: 12px;">DNI: ${alumno?.dni || '-'} | Cat. ${alumno?.categoria || '-'}</p>
          </div>
        </div>
        ${el.innerHTML}
        <div style="text-align: center; font-size: 10px; color: #adb5bd; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">
          Documento generado administrativamente por el sistema de FC Sechura.
        </div>
      </body></html>
    `);
    doc.close(); iframe.contentWindow.focus();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  };

  return (
    <div className="container py-4 mb-5 animate__animated animate__fadeIn">
      
      <div className="d-flex justify-content-between align-items-center mb-4 btn-no-print">
        <button className="btn btn-light shadow-sm border fw-bold text-secondary rounded-pill px-4" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left me-2"></i> Volver al Directorio
        </button>
        {estaMoroso && (
          <button className="btn btn-danger fw-bold rounded-pill shadow px-4 animate__animated animate__pulse animate__infinite" onClick={() => navigate('/registrar-pago')}>
            <i className="fas fa-cash-register me-2"></i> Realizar Cobro
          </button>
        )}
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden mb-4">
            <div className="bg-primary p-4 text-center position-relative" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' }}>
              {alumno?.foto && typeof alumno.foto === 'string' && alumno.foto.length > 10 ? (
                <img src={alumno.foto} alt="Perfil" className="rounded-circle border border-4 border-white shadow bg-white" style={{ width: '130px', height: '130px', objectFit: 'cover' }} />
              ) : (
                <div className="rounded-circle bg-light text-primary d-flex align-items-center justify-content-center mx-auto border border-4 border-white shadow" style={{ width: '130px', height: '130px', fontSize: '3.5rem', fontWeight: '900' }}>
                  {iniciales}
                </div>
              )}
            </div>
            
            <div className="card-body p-4 text-center">
              <h4 className="fw-black text-dark mb-0" style={{ letterSpacing: '-0.5px' }}>{nombreSeguro} {apellidoSeguro}</h4>
              <p className="text-muted mb-3 font-monospace small">DNI: {alumno?.dni || '-'}</p>
              
              <div className="d-flex justify-content-center gap-2 mb-4">
                <span className="badge bg-info bg-opacity-25 text-primary border border-primary rounded-pill px-3 py-2">Cat. {alumno?.categoria || '-'}</span>
                <span className="badge bg-light text-dark border rounded-pill px-3 py-2 shadow-sm">{alumno?.edad || '-'} años</span>
              </div>

              <div className="d-flex gap-2 mb-3">
                {linkWhatsApp ? (
                  <a href={linkWhatsApp} target="_blank" rel="noreferrer" className="btn btn-success flex-fill fw-bold rounded-3 shadow-sm">
                    <i className="fab fa-whatsapp fs-5"></i> Mensaje
                  </a>
                ) : (
                  <button className="btn btn-secondary flex-fill fw-bold rounded-3 opacity-50" disabled><i className="fab fa-whatsapp fs-5"></i> N/R</button>
                )}
                {celularSeguro ? (
                  <a href={`tel:${celularSeguro}`} className="btn btn-light border border-primary text-primary flex-fill fw-bold rounded-3 shadow-sm">
                    <i className="fas fa-phone-alt fs-5"></i> Llamar
                  </a>
                ) : (
                  <button className="btn btn-light border flex-fill fw-bold rounded-3 opacity-50" disabled><i className="fas fa-phone-alt fs-5"></i> N/R</button>
                )}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm rounded-4 mb-4 border-start border-4 border-info">
            <div className="card-body p-3 d-flex align-items-center">
              <div className="bg-info bg-opacity-10 text-info rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px' }}>
                <i className="fas fa-medal fs-5"></i>
              </div>
              <div>
                <span className="text-muted small fw-bold text-uppercase">Inscripción Oficial</span>
                <h5 className="fw-black text-dark mb-0">{alumno?.fechaInscripcion || 'Sin registro'}</h5>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          
          <div className="card border-0 shadow-sm rounded-4 p-2 mb-4 bg-white btn-no-print">
            <ul className="nav nav-pills d-flex flex-wrap flex-md-nowrap gap-1">
              <li className="nav-item flex-fill text-center">
                <button className={`nav-link w-100 rounded-pill fw-bold ${tabActiva === 'general' ? 'active bg-primary shadow-sm' : 'text-secondary'}`} onClick={() => setTabActiva('general')}>
                  <i className="fas fa-address-card me-1 d-none d-md-inline"></i> Datos
                </button>
              </li>
              <li className="nav-item flex-fill text-center">
                <button className={`nav-link w-100 rounded-pill fw-bold ${tabActiva === 'finanzas' ? 'active bg-primary shadow-sm' : 'text-secondary'}`} onClick={() => setTabActiva('finanzas')}>
                  <i className="fas fa-wallet me-1 d-none d-md-inline"></i> Finanzas
                </button>
              </li>
              <li className="nav-item flex-fill text-center">
                <button className={`nav-link w-100 rounded-pill fw-bold ${tabActiva === 'asistencia' ? 'active bg-primary shadow-sm' : 'text-secondary'}`} onClick={() => setTabActiva('asistencia')}>
                  <i className="fas fa-clipboard-check me-1 d-none d-md-inline"></i> Asist.
                </button>
              </li>
            </ul>
          </div>

          <div className="tab-content">
            
            {/* --- TAB 1: DATOS Y FICHA MÉDICA --- */}
            <div className={`tab-pane fade ${tabActiva === 'general' ? 'show active' : ''}`}>
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-header bg-white border-bottom py-3"><h6 className="fw-bold text-primary mb-0"><i className="fas fa-map-marker-alt me-2"></i>Contacto y Residencia</h6></div>
                    <div className="card-body p-4">
                      <div className="mb-3">
                        <small className="text-muted fw-bold text-uppercase">Apoderado Responsable</small>
                        <div className="fw-black text-dark fs-6">{alumno?.apoderado || 'No registrado'}</div>
                      </div>
                      <div className="mb-3">
                        <small className="text-muted fw-bold text-uppercase">Celular</small>
                        <div className="fw-bold text-primary fs-6">{alumno?.celular || 'No registrado'}</div>
                      </div>
                      <div className="mb-0">
                        <small className="text-muted fw-bold text-uppercase">Dirección Actual</small>
                        <div className="fw-medium text-dark">{alumno?.direccion || 'No registrada'} - {alumno?.distrito || ''}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card border-0 shadow-sm rounded-4 h-100 border-start border-4 border-danger">
                    <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                      <h6 className="fw-bold text-danger mb-0"><i className="fas fa-heartbeat me-2"></i>Ficha Médica</h6>
                      {!editandoMedico && (
                        <button className="btn btn-sm btn-outline-danger rounded-pill fw-bold py-1 px-3" onClick={() => setEditandoMedico(true)}>
                          Editar
                        </button>
                      )}
                    </div>
                    <div className="card-body p-4">
                      {!editandoMedico && alumno.medico?.alergias && (
                        <div className="alert alert-danger py-2 px-3 border border-danger shadow-sm d-flex align-items-center animate__animated animate__pulse animate__infinite">
                          <i className="fas fa-exclamation-triangle me-2"></i>
                          <div className="small fw-bold">{alumno.medico.alergias}</div>
                        </div>
                      )}

                      {editandoMedico ? (
                        <div className="row g-3 animate__animated animate__fadeIn">
                          <div className="col-12">
                            <label className="form-label small fw-bold text-muted mb-1 text-uppercase">Grupo Sanguíneo</label>
                            <select name="tipoSangre" className="form-select form-select-sm border-2 fw-bold" value={datosMedicos.tipoSangre} onChange={handleMedicoChange}>
                              <option value="No especificado">No especificado</option>
                              <option value="O+">O Positivo (O+)</option>
                              <option value="O-">O Negativo (O-)</option>
                              <option value="A+">A Positivo (A+)</option>
                              <option value="A-">A Negativo (A-)</option>
                              <option value="B+">B Positivo (B+)</option>
                              <option value="B-">B Negativo (B-)</option>
                              <option value="AB+">AB Positivo (AB+)</option>
                              <option value="AB-">AB Negativo (AB-)</option>
                            </select>
                          </div>
                          <div className="col-12">
                            <label className="form-label small fw-bold text-danger mb-1 text-uppercase">Alergias</label>
                            <input type="text" name="alergias" className="form-control form-control-sm border-2 border-danger text-danger fw-bold" placeholder="Ej: Asma, Penicilina..." value={datosMedicos.alergias} onChange={handleMedicoChange} />
                          </div>
                          <div className="col-12">
                            <label className="form-label small fw-bold text-muted mb-1 text-uppercase">Lesiones Previas</label>
                            <textarea name="lesionesPrevias" className="form-control form-control-sm border-2" rows="2" placeholder="Ej: Esguince derecho" value={datosMedicos.lesionesPrevias} onChange={handleMedicoChange}></textarea>
                          </div>
                          <div className="col-12">
                            <label className="form-label small fw-bold text-muted mb-1 text-uppercase">Seguro de Salud</label>
                            <input type="text" name="seguro" className="form-control form-control-sm border-2" placeholder="Ej: EsSalud, Sanna" value={datosMedicos.seguro} onChange={handleMedicoChange} />
                          </div>
                          <div className="col-12 d-flex gap-2 mt-2">
                            <button className="btn btn-sm btn-light border fw-bold w-50" onClick={() => setEditandoMedico(false)} disabled={guardandoMedico}>Cancelar</button>
                            <button className="btn btn-sm btn-danger fw-bold w-50" onClick={guardarFichaMedica} disabled={guardandoMedico}>
                              {guardandoMedico ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="row g-3">
                          <div className="col-6">
                            <small className="text-muted fw-bold text-uppercase">Tipo Sangre</small>
                            <div className="fw-black text-danger fs-5">{alumno?.medico?.tipoSangre || 'N/R'}</div>
                          </div>
                          <div className="col-6">
                            <small className="text-muted fw-bold text-uppercase">Seguro Médico</small>
                            <div className="fw-medium text-dark">{alumno?.medico?.seguro || 'N/R'}</div>
                          </div>
                          <div className="col-12">
                            <small className="text-muted fw-bold text-uppercase">Lesiones Previas</small>
                            <div className="fw-medium text-dark small">{alumno?.medico?.lesionesPrevias || 'Ninguna registrada.'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* --- TAB 3: FINANZAS Y LTV --- */}
            <div className={`tab-pane fade ${tabActiva === 'finanzas' ? 'show active' : ''}`}>
              
              <div className={`card border-0 shadow-sm rounded-4 mb-4 ${estaMoroso ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                <div className="card-body p-4 p-md-5 text-center">
                  <i className={`fas ${estaMoroso ? 'fa-exclamation-triangle' : 'fa-check-circle'} fa-4x mb-3`}></i>
                  <h2 className="fw-black">{estaMoroso ? 'ESTADO MOROSO' : 'ALUMNO AL DÍA'}</h2>
                  <p className="mb-0 fs-5 fw-medium">
                    {estaMoroso && debeMes ? `Mensualidad vencida hace ${diasAtraso} días (${vencimiento}).` : (estaMoroso ? 'Existen saldos de tienda/servicios pendientes.' : `Próximo corte mensual: ${vencimiento}`)}
                  </p>
                </div>
              </div>

              <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 border">
                <div className="d-flex justify-content-between align-items-end mb-2">
                  <div>
                    <h6 className="fw-bold text-dark mb-0">Cumplimiento de Pagos (LTV)</h6>
                    <small className="text-muted">Total facturado vs pagado desde su inscripción.</small>
                  </div>
                  <div className="text-end">
                    <h3 className="fw-black text-primary mb-0">S/. {totalPagado.toFixed(2)}</h3>
                    <small className="text-muted fw-bold text-uppercase">Pagado Histórico</small>
                  </div>
                </div>
                <div className="progress mt-3 shadow-inner" style={{ height: '22px', borderRadius: '10px' }}>
                  <div className={`progress-bar ${porcentajeCumplimiento === 100 ? 'bg-success' : 'bg-warning text-dark fw-bold'}`} role="progressbar" style={{ width: `${porcentajeCumplimiento}%` }}>
                    {porcentajeCumplimiento}% Cumplimiento
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center btn-no-print border-bottom">
                  <h6 className="fw-bold mb-0"><i className="fas fa-receipt text-primary me-2"></i>Movimientos y Recibos</h6>
                  <button className="btn btn-sm btn-outline-danger fw-bold rounded-pill" onClick={() => imprimirReporte('area-impresion-kardex', 'Estado de Cuenta y Transacciones')}>
                    <i className="fas fa-file-pdf me-1"></i> Imprimir Edo. Cuenta
                  </button>
                </div>
                <div className="card-body p-0" id="area-impresion-kardex">
                  <div className="table-responsive" style={{ maxHeight: '400px' }}>
                    <table className="table table-hover align-middle mb-0">
                      <thead className="bg-light sticky-top">
                        <tr>
                          <th className="py-3 ps-4 small fw-bold text-muted text-uppercase">Fecha</th>
                          <th className="py-3 small fw-bold text-muted text-uppercase">Tipo</th>
                          <th className="py-3 small fw-bold text-muted text-uppercase">Concepto</th>
                          <th className="py-3 small fw-bold text-muted text-uppercase text-end">Monto</th>
                          <th className="py-3 pe-4 small fw-bold text-muted text-uppercase text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargando ? <tr><td colSpan="5" className="text-center py-4"><div className="spinner-border text-primary"></div></td></tr> : lineaTiempoFinanciera.length === 0 ? <tr><td colSpan="5" className="text-center py-4 text-muted fw-medium">No se registran transacciones.</td></tr> : (
                          lineaTiempoFinanciera.map(mov => {
                            const esPago = mov.tipoRegistro === 'Pago';
                            
                            // === LOGICA DE PRIVACIDAD PARA BECADOS ===
                            const conceptoOriginal = String(mov.conceptoResumen || mov.concepto || '-');
                            const esBecado = conceptoOriginal.includes('BECADO');
                            const conceptoLimpioParaImpresion = conceptoOriginal.replace('(BECADO)', '').trim();

                            return (
                              <tr key={String(mov.id)}>
                                <td className="ps-4 text-dark fw-bold small">{mov.fecha || mov.fechaGeneracion || mov.fechaPago || '-'}</td>
                                <td>
                                  <span className={`badge ${esPago ? 'bg-success bg-opacity-10 text-success border border-success' : 'bg-danger bg-opacity-10 text-danger border border-danger'} rounded-pill px-3 py-1`}>
                                    {esPago ? 'Pago R.' : 'Deuda'}
                                  </span>
                                </td>
                                <td className="fw-medium text-dark" style={{ fontSize: '13px' }}>
                                  {conceptoLimpioParaImpresion}
                                  {/* Etiqueta oculta al imprimir pero visible en pantalla */}
                                  {esBecado && <span className="badge bg-success bg-opacity-25 text-success border border-success ms-2 btn-no-print" title="Solo visible para Administración">BECADO</span>}
                                  {mov.idRecibo && <div className="text-muted small font-monospace mt-1">Ref: {mov.idRecibo}</div>}
                                </td>
                                <td className={`text-end fw-black fs-6 ${esPago ? 'text-success' : 'text-danger'}`}>
                                  {esPago ? '+' : '-'} S/ {mov.total || mov.monto || '0'}
                                </td>
                                <td className="pe-4 text-center">
                                  <span className={`badge border ${mov.estado === 'Completado' || mov.estado === 'Pagado' ? 'bg-success bg-opacity-10 text-success border-success' : 'bg-warning bg-opacity-10 text-warning border-warning'} rounded-pill px-3 py-1`}>
                                    {mov.estado || '-'}
                                  </span>
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

            {/* --- TAB 4: ASISTENCIAS --- */}
            <div className={`tab-pane fade ${tabActiva === 'asistencia' ? 'show active' : ''}`}>
              <div className="row g-3 mb-4 btn-no-print">
                <div className="col-12 col-md-4">
                  <div className="bg-success bg-opacity-10 p-3 rounded-4 text-center border border-success border-opacity-25 h-100 d-flex flex-column justify-content-center shadow-sm">
                    <h2 className="fw-black text-success mb-0">{porcentajeAsistencia}%</h2><span className="fw-bold small text-success text-uppercase">Tasa de Asistencia</span>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="bg-warning bg-opacity-10 p-3 rounded-4 text-center border border-warning border-opacity-25 h-100 d-flex flex-column justify-content-center shadow-sm">
                    <h2 className="fw-black text-warning mb-0" style={{color:'#d97706'}}>{tardanzasCount}</h2><span className="fw-bold small text-warning text-uppercase" style={{color:'#d97706'}}>Tardanzas</span>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="bg-danger bg-opacity-10 p-3 rounded-4 text-center border border-danger border-opacity-25 h-100 d-flex flex-column justify-content-center shadow-sm">
                    <h2 className="fw-black text-danger mb-0">{faltasCount}</h2><span className="fw-bold small text-danger text-uppercase">Faltas Acumuladas</span>
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center btn-no-print border-bottom">
                  <select className="form-select form-select-sm w-auto fw-bold text-primary border-2 shadow-sm" value={filtroMesAsistencia} onChange={(e) => setFiltroMesAsistencia(e.target.value)}>
                    <option value="Todos">Historial Completo</option>
                    <option value="05/2026">Mayo 2026</option>
                    <option value="04/2026">Abril 2026</option>
                    <option value="03/2026">Marzo 2026</option>
                  </select>
                  <button className="btn btn-sm btn-outline-danger fw-bold rounded-pill" onClick={() => imprimirReporte('area-impresion-asistencia', `Kárdex de Asistencia (${filtroMesAsistencia})`)}>
                    <i className="fas fa-file-pdf me-1"></i> Exportar PDF
                  </button>
                </div>
                <div className="card-body p-0" id="area-impresion-asistencia">
                  <div className="table-responsive" style={{ maxHeight: '400px' }}>
                    <table className="table table-hover align-middle mb-0 text-center">
                      <thead className="bg-light sticky-top">
                        <tr>
                          <th className="py-3 text-muted small fw-bold text-uppercase">Fecha</th>
                          <th className="py-3 text-muted small fw-bold text-uppercase">Hora de Ingreso</th>
                          <th className="py-3 text-muted small fw-bold text-uppercase">Estado Reportado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargando ? <tr><td colSpan="3" className="py-4">Cargando...</td></tr> : asistenciaFiltrada.length === 0 ? <tr><td colSpan="3" className="py-4 text-muted fw-medium">No existen registros de asistencia.</td></tr> : (
                          asistenciaFiltrada.map(a => (
                            <tr key={a.id}>
                              <td className="fw-black text-dark">{a.fecha || '-'}</td>
                              <td className="font-monospace text-muted">{a.horaIngreso || '--:--'}</td>
                              <td><span className={`badge rounded-pill px-4 py-2 ${a.estado === 'Asistió' ? 'bg-success' : a.estado === 'Tarde' ? 'bg-warning text-dark' : 'bg-danger'}`}>{a.estado ? a.estado.toUpperCase() : '-'}</span></td>
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

export default DetalleAlumno;