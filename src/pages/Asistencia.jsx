import React, { useState, useEffect, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

// === IMPORTACIONES DE FIRESTORE ===
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';

const Asistencia = () => {
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [asistencias, setAsistencias] = useState([]);
  const [ultimoMensaje, setUltimoMensaje] = useState(null);
  const [dbAlumnos, setDbAlumnos] = useState([]);
  
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [asistenciaAEliminar, setAsistenciaAEliminar] = useState(null);

  // === ESTADOS PARA EL REGISTRO MANUAL ===
  const [mostrarManual, setMostrarManual] = useState(false);
  const [busquedaManual, setBusquedaManual] = useState('');
  const [filtroCatManual, setFiltroCatManual] = useState('Todas');

  const bloqueosQR = useRef({}); 

  const ahoraGlobal = new Date();
  const diaG = ahoraGlobal.getDate().toString().padStart(2, '0');
  const mesG = (ahoraGlobal.getMonth() + 1).toString().padStart(2, '0');
  const anioG = ahoraGlobal.getFullYear();
  const fechaHoyStr = `${diaG}/${mesG}/${anioG}`;

  useEffect(() => {
    const fetchAlumnos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'alumnos'));
        const lista = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setDbAlumnos(lista);
      } catch (error) {
        console.error("Error cargando alumnos: ", error);
      }
    };
    fetchAlumnos();
  }, []);

  useEffect(() => {
    const cargarAsistenciasHoy = async () => {
      try {
        const q = query(
          collection(db, 'asistencias'),
          where('fecha', '==', fechaHoyStr),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const registrosHoy = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAsistencias(registrosHoy);
      } catch (error) {
        console.error("Error cargando asistencias de hoy: ", error);
      }
    };
    cargarAsistenciasHoy();
  }, [fechaHoyStr]);

  const reproducirBeep = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {}); 
  };

  // === LÓGICA CENTRALIZADA DE ASISTENCIA (Sirve para QR y Manual) ===
  const procesarRegistro = async (dniEscaneado, esManual = false) => {
    if (!dniEscaneado) return;

    // Solo aplicamos anti-rebote si viene de la cámara QR
    if (!esManual) {
      const tiempoActualMs = Date.now();
      const ultimoEscaneoDeEsteDni = bloqueosQR.current[dniEscaneado] || 0;
      if (tiempoActualMs - ultimoEscaneoDeEsteDni < 30000) return; 
      bloqueosQR.current[dniEscaneado] = tiempoActualMs;
    }

    const ahora = new Date();
    const horaActualNumerica = ahora.getHours();
    const horaExacta = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const indexLocal = asistencias.findIndex(a => a.dni === dniEscaneado);

    // --- CASO 1: INGRESO NUEVO ---
    if (indexLocal === -1) {
      reproducirBeep();
      let estadoFinal = horaActualNumerica >= 21 ? 'Tarde' : 'Asistió';
      const alumno = dbAlumnos.find(a => a.dni === dniEscaneado);
      
      const datosNube = {
        alumnoId: alumno?.id || null,
        nombre: alumno ? `${alumno.nombre} ${alumno.apellido}` : 'Desconocido',
        dni: dniEscaneado,
        categoria: alumno?.categoria || '-',
        fecha: fechaHoyStr,
        horaIngreso: horaExacta,
        horaSalida: '--:--',
        estado: estadoFinal,
        pagoCancha: false,
        montoCancha: 0,
        createdAt: serverTimestamp()
      };

      try {
        const docRef = await addDoc(collection(db, 'asistencias'), datosNube);
        setAsistencias([{ ...datosNube, id: docRef.id }, ...asistencias]);
        setUltimoMensaje({ dni: dniEscaneado, nombre: datosNube.nombre, accion: esManual ? 'INGRESO MANUAL OK' : 'INGRESO REGISTRADO', color: 'bg-success' });
      } catch (e) { console.error("Error al guardar ingreso:", e); }

    } 
    // --- CASO 2 Y 3: REGISTRAR O ACTUALIZAR SALIDA ---
    else {
      reproducirBeep();
      const idFirestore = asistencias[indexLocal].id;
      const teniaSalidaPrevia = asistencias[indexLocal].horaSalida !== '--:--';

      try {
        await updateDoc(doc(db, 'asistencias', idFirestore), { horaSalida: horaExacta });
        const nuevasAsistencias = [...asistencias];
        nuevasAsistencias[indexLocal].horaSalida = horaExacta;
        setAsistencias(nuevasAsistencias);
        
        if (!teniaSalidaPrevia) {
          setUltimoMensaje({ dni: dniEscaneado, nombre: nuevasAsistencias[indexLocal].nombre, accion: esManual ? 'SALIDA MANUAL OK' : 'SALIDA REGISTRADA', color: 'bg-info text-dark' });
        } else {
          setUltimoMensaje({ dni: dniEscaneado, nombre: nuevasAsistencias[indexLocal].nombre, accion: 'HORA DE SALIDA ACTUALIZADA', color: 'bg-warning text-dark' });
        }
      } catch (e) { console.error("Error al guardar salida:", e); }
    }

    setTimeout(() => setUltimoMensaje(null), 3500);
  };

  const handleScan = async (resultadoLibreria) => {
    if (!resultadoLibreria) return;
    let textoEscaneado = '';
    if (typeof resultadoLibreria === 'string') textoEscaneado = resultadoLibreria;
    else if (Array.isArray(resultadoLibreria) && resultadoLibreria.length > 0) textoEscaneado = resultadoLibreria[0].rawValue;
    
    textoEscaneado = textoEscaneado?.trim();
    procesarRegistro(textoEscaneado, false);
  };

  const togglePagoCancha = async (asistencia) => {
    const nuevoEstadoPago = !asistencia.pagoCancha;
    try {
      await updateDoc(doc(db, 'asistencias', asistencia.id), { 
        pagoCancha: nuevoEstadoPago,
        montoCancha: nuevoEstadoPago ? 3 : 0 
      });
      setAsistencias(asistencias.map(a => 
        a.id === asistencia.id ? { ...a, pagoCancha: nuevoEstadoPago } : a
      ));
    } catch (e) { console.error("Error actualizando pago:", e); }
  };

  const ejecutarBorrado = async () => {
    try {
      await deleteDoc(doc(db, 'asistencias', asistenciaAEliminar.id));
      setAsistencias(asistencias.filter(a => a.id !== asistenciaAEliminar.id));
      setAsistenciaAEliminar(null);
    } catch (e) { console.error("Error eliminando:", e); }
  };

  // Filtros para la tabla principal
  const asistenciasProcesadas = asistencias
    .filter(a => filtroCategoria === 'Todas' ? true : a.categoria === filtroCategoria)
    .sort((a, b) => {
      if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
      return 0; 
    });

  // Filtros para el modal de Registro Manual
  const alumnosFiltradosManual = dbAlumnos
    .filter(a => {
      const term = busquedaManual.toLowerCase();
      const coincideBusqueda = a.nombre.toLowerCase().includes(term) || a.apellido.toLowerCase().includes(term) || a.dni.includes(term);
      const coincideCat = filtroCatManual === 'Todas' ? true : a.categoria === filtroCatManual;
      return coincideBusqueda && coincideCat;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const cajaChica = asistencias.filter(a => a.pagoCancha).length * 3;

  return (
    <div className="container py-4 mb-5">
      
      {/* HEADER */}
      <div className="row mb-4 align-items-center">
        <div className="col-md-7">
          <h1 className="fw-bold" style={{ color: 'var(--fc-azul)' }}>Asistencia en Tiempo Real</h1>
          <p className="text-muted fw-semibold">
            <i className="fas fa-sync-alt fa-spin me-2 text-primary"></i> 
            Sincronización automática con la nube activada
          </p>
        </div>
        <div className="col-md-5 text-md-end d-flex gap-2 justify-content-md-end flex-wrap">
          <button 
            className="btn btn-lg rounded-pill px-4 fw-bold shadow-sm border border-2 text-dark bg-white hover-bg-light"
            onClick={() => setMostrarManual(true)}
          >
            <i className="fas fa-keyboard me-2 text-primary"></i> Registro Manual
          </button>
          <button 
            className={`btn btn-lg rounded-pill px-4 fw-bold shadow-sm ${camaraActiva ? 'btn-danger' : 'btn-turquesa text-white'}`}
            onClick={() => setCamaraActiva(!camaraActiva)}
          >
            {camaraActiva ? <><i className="fas fa-video-slash me-2"></i> Cerrar Lector</> : <><i className="fas fa-camera me-2"></i> Abrir Lector</>}
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* LADO IZQUIERDO: SCANNER */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden h-100">
            <div className="card-header bg-white py-3 border-bottom text-center">
              <h6 className="fw-bold text-uppercase mb-0 text-secondary small">Escáner de Identidad</h6>
            </div>
            <div className="card-body p-0 bg-dark d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '350px', position: 'relative' }}>
              {camaraActiva ? (
                <div style={{ width: '100%', height: '100%' }}>
                  <Scanner onScan={handleScan} onResult={handleScan} options={{ delayBetweenScanAttempts: 2000 }} />
                  <div className="scanning-line"></div>
                </div>
              ) : (
                <div className="text-center text-white-50">
                  <i className="fas fa-qrcode fa-4x mb-3"></i>
                  <p className="small">Cámara desactivada</p>
                </div>
              )}

              {ultimoMensaje && (
                <div className={`position-absolute bottom-0 start-0 end-0 py-3 text-center text-white fw-bold shadow-lg animate__animated animate__slideInUp ${ultimoMensaje.color}`}>
                  {ultimoMensaje.accion} <br/> 
                  <span className="small opacity-75">{ultimoMensaje.nombre}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LADO DERECHO: TABLA CON FILTRO */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden">
            <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h6 className="fw-bold mb-0">Tránsito del Día</h6>
              
              <div className="d-flex align-items-center gap-2">
                <select 
                  className="form-select form-select-sm border-2 fw-bold text-secondary bg-light"
                  style={{ width: '140px' }}
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                >
                  <option value="Todas">Todas las Cat.</option>
                  {['6', '8', '10', '12', '13', '14', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
                </select>

                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 ms-2">
                  Caja Chica: S/. {cajaChica.toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="card-body p-0 table-responsive">
              <table className="table table-hover align-middle mb-0 text-center">
                <thead className="bg-light">
                  <tr>
                    <th className="py-3 text-start ps-4">Alumno</th>
                    <th className="py-3">Horarios</th>
                    <th className="py-3">Cancha</th>
                    <th className="py-3">Estado</th>
                    <th className="py-3 pe-4">Borrar</th>
                  </tr>
                </thead>
                <tbody>
                  {asistenciasProcesadas.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-5 text-muted opacity-50">
                        {asistencias.length === 0 ? 'No hay registros hoy' : 'No hay alumnos de esta categoría hoy'}
                      </td>
                    </tr>
                  ) : (
                    asistenciasProcesadas.map((a) => (
                      <tr key={a.id} className="animate__animated animate__fadeIn">
                        <td className="ps-4 text-start">
                          <div className="fw-bold text-dark">{a.nombre}</div>
                          <div className="small font-monospace">
                            <span className="text-muted">{a.dni}</span> | <span className="text-azul fw-bold">Cat. {a.categoria}</span>
                          </div>
                        </td>
                        <td className="small font-monospace">
                          <span className="text-success">{a.horaIngreso}</span> | <span className="text-danger">{a.horaSalida}</span>
                        </td>
                        <td>
                          <button 
                            className={`btn btn-sm rounded-pill px-3 fw-bold ${a.pagoCancha ? 'btn-success' : 'btn-light border'}`}
                            onClick={() => togglePagoCancha(a)}
                          >
                            {a.pagoCancha ? 'Pagó' : 'S/3'}
                          </button>
                        </td>
                        <td>
                          <span className={`badge rounded-pill px-3 py-2 text-dark ${a.estado === 'Asistió' ? 'bg-celeste' : 'bg-warning'}`}>
                            {a.estado}
                          </span>
                        </td>
                        <td className="pe-4">
                          <button className="btn btn-sm btn-outline-danger border-0" onClick={() => setAsistenciaAEliminar(a)}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* === MODAL: REGISTRO MANUAL === */}
      {mostrarManual && (
        <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ zIndex: 1500 }}>
          <div className="bg-white p-4 rounded-4 shadow-lg w-100 mx-3 animate__animated animate__zoomIn" style={{ maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
              <h5 className="fw-bold text-dark mb-0"><i className="fas fa-user-edit me-2 text-primary"></i> Registro Manual</h5>
              <button className="btn btn-sm btn-light rounded-circle" onClick={() => setMostrarManual(false)}>
                <i className="fas fa-times fs-5 text-secondary"></i>
              </button>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-8">
                <input 
                  type="text" 
                  className="form-control form-control-lg bg-light border-0 shadow-none" 
                  placeholder="Buscar por Nombre o DNI..." 
                  value={busquedaManual}
                  onChange={(e) => setBusquedaManual(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <select 
                  className="form-select form-select-lg bg-light border-0 shadow-none fw-bold text-secondary"
                  value={filtroCatManual}
                  onChange={(e) => setFiltroCatManual(e.target.value)}
                >
                  <option value="Todas">Todas las Cat.</option>
                  {['6', '8', '10', '12', '13', '14', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
                </select>
              </div>
            </div>

            <div className="list-group overflow-auto custom-scrollbar pe-2" style={{ flexGrow: 1, maxHeight: '400px' }}>
              {alumnosFiltradosManual.length === 0 ? (
                <div className="text-center text-muted py-4">No se encontraron alumnos con esa búsqueda.</div>
              ) : (
                alumnosFiltradosManual.map(alumno => {
                  const registroHoy = asistencias.find(a => a.dni === alumno.dni);
                  const yaIngreso = !!registroHoy;
                  const yaSalio = yaIngreso && registroHoy.horaSalida !== '--:--';

                  return (
                    <div key={alumno.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center border-0 border-bottom py-3">
                      <div>
                        <div className="fw-bold text-dark">{alumno.nombre} {alumno.apellido}</div>
                        <div className="small font-monospace text-muted">DNI: {alumno.dni} | Cat. {alumno.categoria}</div>
                      </div>
                      
                      <div>
                        {!yaIngreso ? (
                          <button className="btn btn-sm btn-primary rounded-pill px-3 fw-bold shadow-sm" onClick={() => procesarRegistro(alumno.dni, true)}>
                            Ingresó
                          </button>
                        ) : !yaSalio ? (
                          <button className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" onClick={() => procesarRegistro(alumno.dni, true)}>
                            Marcar Salida
                          </button>
                        ) : (
                          <span className="badge bg-success rounded-pill px-3 py-2"><i className="fas fa-check-circle me-1"></i> Completado</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
      {asistenciaAEliminar && (
        <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ zIndex: 2000 }}>
          <div className="bg-white p-4 rounded-4 shadow-lg text-center mx-3 animate__animated animate__zoomIn" style={{ maxWidth: '350px' }}>
            <div className="text-danger mb-3"><i className="fas fa-exclamation-circle fa-3x"></i></div>
            <h5 className="fw-bold">¿Eliminar registro?</h5>
            <p className="text-muted small">Vas a borrar la asistencia de <strong>{asistenciaAEliminar.nombre}</strong>. Esta acción se reflejará en la nube al instante.</p>
            <div className="d-flex gap-2">
              <button className="btn btn-light w-100 fw-bold" onClick={() => setAsistenciaAEliminar(null)}>Cancelar</button>
              <button className="btn btn-danger w-100 fw-bold" onClick={ejecutarBorrado}>Sí, Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Asistencia;