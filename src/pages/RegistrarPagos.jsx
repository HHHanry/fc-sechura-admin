import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';

const RegistrarPagos = () => {
  // === ESTADOS GLOBALES ===
  const [alumnosBD, setAlumnosBD] = useState([]);
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [alumnoEncontrado, setAlumnoEncontrado] = useState(null);
  const [deudasAlumno, setDeudasAlumno] = useState([]); 
  const [procesando, setProcesando] = useState(false);
  
  const [reciboGenerado, setReciboGenerado] = useState(null);
  const [errorModal, setErrorModal] = useState(null);

  // === CATÁLOGO DE PRODUCTOS (Mensualidad ajustada a S/ 65) ===
  const catalogoPrecios = {
    'Mensualidad': 65,
    'Mensualidad (BECADO)': 0, // <-- NUEVA OPCIÓN
    'Matrícula Anual': 50,
    'Uniforme Completo': 80,
    'Polo de Entrenamiento': 35,
    'Short Deportivo': 25,
    'Inscripción a Torneo': 40
  };

  const mesesArray = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // === ESTADOS DE LA CAJA (POS) ===
  const [carrito, setCarrito] = useState([]);
  const [nuevoItem, setNuevoItem] = useState({ concepto: 'Mensualidad', monto: catalogoPrecios['Mensualidad'], detalle: '', mesEspecifico: mesesArray[new Date().getMonth()] });
  const [montoEntregado, setMontoEntregado] = useState(''); 
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [fechaOperacion, setFechaOperacion] = useState(new Date().toISOString().split('T')[0]);

  // Cargar alumnos
  useEffect(() => {
    const fetchAlumnos = async () => {
      try {
        const snap = await getDocs(collection(db, 'alumnos'));
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
        setAlumnosBD(lista);
      } catch (error) { console.error(error); }
    };
    fetchAlumnos();
  }, []);

  // Buscar deudas y estado del alumno seleccionado
  useEffect(() => {
    const fetchDeudas = async () => {
      if (alumnoEncontrado && alumnoEncontrado.id) {
        try {
          const q = query(collection(db, 'deudas'), where('alumnoId', '==', alumnoEncontrado.id), where('estado', '==', 'Pendiente'));
          const snap = await getDocs(q);
          setDeudasAlumno(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) { console.error(error); }
      } else {
        setDeudasAlumno([]);
      }
    };
    fetchDeudas();
  }, [alumnoEncontrado]);

  // Cálculos Dinámicos
  const totalCarrito = carrito.reduce((sum, item) => sum + parseFloat(item.monto), 0);
  const entregadoNum = parseFloat(montoEntregado) || 0;
  const deudaGenerada = totalCarrito - entregadoNum > 0 ? totalCarrito - entregadoNum : 0;
  const vuelto = entregadoNum - totalCarrito > 0 ? entregadoNum - totalCarrito : 0;

  useEffect(() => {
    // Si el carrito tiene cosas que cuestan dinero, sugerimos el exacto
    if (carrito.length > 0 && montoEntregado === '' && totalCarrito > 0) {
      setMontoEntregado(totalCarrito.toString());
    } 
    // Si el total es 0 (ej: solo hay una beca), el monto entregado DEBE ser 0
    else if (totalCarrito === 0 && carrito.length > 0) {
      setMontoEntregado('0');
    }
    else if (carrito.length === 0) {
      setMontoEntregado('');
    }
  }, [totalCarrito, carrito]);

  // === FUNCIONES DE UI ===
  const seleccionarAlumno = (alumno) => { setAlumnoEncontrado(alumno); setBusquedaTexto(''); };
  const cancelarSeleccion = () => { setAlumnoEncontrado(null); setCarrito([]); setMontoEntregado(''); setDeudasAlumno([]); };

  const handleConceptoChange = (e) => {
    const concepto = e.target.value;
    setNuevoItem({ ...nuevoItem, concepto: concepto, monto: catalogoPrecios[concepto] || 0 });
    
    // Si elige Beca, forzamos que el método de pago no sea Efectivo, sino una "Aprobación" interna
    if (concepto === 'Mensualidad (BECADO)') {
      setMetodoPago('Aprobación Interna');
    } else {
      setMetodoPago('Efectivo');
    }
  };

  const agregarAlCarrito = () => {
    // Ya no bloqueamos si el monto es 0, porque la Beca cuesta 0
    if (nuevoItem.monto < 0) return setErrorModal("El costo no puede ser negativo.");
    
    let nombreFinal = nuevoItem.concepto;
    if (nuevoItem.concepto.includes('Mensualidad')) {
      nombreFinal = `${nuevoItem.concepto} (${nuevoItem.mesEspecifico})`;
    }

    setCarrito([...carrito, { ...nuevoItem, concepto: nombreFinal, id: Date.now(), isDeudaVieja: false }]);
    setNuevoItem({ concepto: 'Mensualidad', monto: catalogoPrecios['Mensualidad'], detalle: '', mesEspecifico: mesesArray[new Date().getMonth()] });
  };

  const quitarDelCarrito = (id) => { setCarrito(carrito.filter(item => item.id !== id)); };

  const agregarDeudaViejaAlCarrito = (deuda) => {
    if (carrito.find(c => c.deudaId === deuda.id)) return setErrorModal("Esta deuda ya está en el carrito.");
    setCarrito([...carrito, { id: Date.now(), concepto: `Cobro Deuda: ${deuda.concepto}`, monto: deuda.monto, isDeudaVieja: true, deudaId: deuda.id }]);
  };

  // === PROCESO FINANCIERO ===
  const procesarCaja = async (e) => {
    e.preventDefault();
    if (!alumnoEncontrado) return setErrorModal("Identifica al alumno primero.");
    if (carrito.length === 0) return setErrorModal("El carrito está vacío.");
    if (entregadoNum < 0) return setErrorModal("El monto no puede ser negativo.");

    setProcesando(true);

    try {
      const resumenNombres = carrito.map(c => c.concepto).join(' + ');
      const numeroRecibo = `REC-${Date.now().toString().slice(-6)}`;
      let reciboGeneradoData = null;

      // A: Guardar el movimiento (Incluso si es S/ 0 por Beca, se guarda como Comprobante)
      const montoRealAlRecibo = entregadoNum > totalCarrito ? totalCarrito : entregadoNum; 
      
      await addDoc(collection(db, 'pagos'), {
        idRecibo: numeroRecibo,
        alumnoId: alumnoEncontrado.id,
        alumnoNombre: `${alumnoEncontrado.nombre} ${alumnoEncontrado.apellido}`,
        alumnoDni: alumnoEncontrado.dni || '',
        fecha: fechaOperacion,
        metodo: metodoPago,
        conceptoResumen: resumenNombres,
        items: carrito,
        total: montoRealAlRecibo,
        estado: 'Completado',
        createdAt: serverTimestamp()
      });

      reciboGeneradoData = { numero: numeroRecibo, totalPagado: montoRealAlRecibo.toFixed(2), alumno: alumnoEncontrado.nombre, deudaCreada: deudaGenerada.toFixed(2) };

      // B: Generar la deuda si no alcanzó
      if (deudaGenerada > 0) {
        await addDoc(collection(db, 'deudas'), {
          alumnoId: alumnoEncontrado.id,
          alumnoNombre: `${alumnoEncontrado.nombre} ${alumnoEncontrado.apellido}`,
          concepto: `Saldo pendiente de: ${resumenNombres}`,
          monto: deudaGenerada,
          fechaGeneracion: fechaOperacion,
          estado: 'Pendiente',
          createdAt: serverTimestamp()
        });
      }

      // C: Pagar deudas viejas si estaban en el carrito
      for (let item of carrito) {
        if (item.isDeudaVieja && entregadoNum > 0) {
          await updateDoc(doc(db, 'deudas', item.deudaId), { estado: 'Pagado', fechaPago: fechaOperacion });
        }
      }

      // D: Lógica de la Mensualidad o Beca (Adelantar mes)
      const pagoMensualidad = carrito.find(c => c.concepto.includes('Mensualidad'));
      // Solo adelantamos si se pagó completo (o si es beca que cuesta 0)
      if (pagoMensualidad && deudaGenerada === 0) {
        const fechaVencimientoActual = new Date(alumnoEncontrado.vencimientoMensualidad || fechaOperacion);
        // Sumamos 1 mes asegurando la misma zona horaria
        fechaVencimientoActual.setUTCMonth(fechaVencimientoActual.getUTCMonth() + 1);
        const nuevoVencimiento = fechaVencimientoActual.toISOString().split('T')[0];
        
        await updateDoc(doc(db, 'alumnos', alumnoEncontrado.id), {
          vencimientoMensualidad: nuevoVencimiento
        });
      }

      setReciboGenerado(reciboGeneradoData);
      setAlumnoEncontrado(null);
      setCarrito([]);
      setMontoEntregado('');
      
    } catch (error) {
      console.error(error);
      setErrorModal("Fallo de conexión al procesar la caja.");
    } finally {
      setProcesando(false);
    }
  };

  const hoyStr = new Date().toISOString().split('T')[0];
  const estaMoroso = alumnoEncontrado ? hoyStr >= (alumnoEncontrado.vencimientoMensualidad || '2000-01-01') : false;

  const alumnosFiltrados = alumnosBD.filter(a => filtroCategoria === 'Todas' ? true : a.categoria === filtroCategoria);
  const resultadosBusqueda = busquedaTexto.trim().length > 1 ? alumnosFiltrados.filter(a => {
    const texto = busquedaTexto.toLowerCase();
    return (a.nombre || '').toLowerCase().includes(texto) || (a.apellido || '').toLowerCase().includes(texto) || (a.dni || '').includes(texto);
  }).slice(0, 6) : [];

  return (
    <div className="container py-4 mb-5">
      <div className="row mb-4 align-items-center">
        <div className="col-12">
          <h1 className="fw-black text-dark tracking-tight"><i className="fas fa-desktop me-3 text-primary"></i>Terminal POS Central</h1>
          <p className="text-muted fs-5">Recepción de pagos, abonos parciales y auditoría de deudas.</p>
        </div>
      </div>

      <div className="row g-4">
        {/* =========================================================
            PANEL IZQUIERDO: BÚSQUEDA Y CARRITO DE COMPRAS
            ========================================================= */}
        <div className="col-lg-7">
          
          {/* PASO 1: SELECCIONAR CLIENTE */}
          <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
            <div className="card-header bg-transparent py-3 border-bottom d-flex align-items-center">
              <span className="badge bg-primary rounded-circle p-2 me-2">1</span>
              <h6 className="fw-bold mb-0 text-dark">Identificar Cliente (Alumno)</h6>
            </div>
            
            <div className="card-body p-4">
              {!alumnoEncontrado ? (
                <div className="position-relative">
                  <div className="row g-2 mb-3">
                    <div className="col-md-8">
                      <div className="input-group input-group-lg shadow-sm">
                        <span className="input-group-text bg-white border-2 border-end-0 text-muted"><i className="fas fa-search"></i></span>
                        <input type="text" className="form-control border-2 border-start-0 ps-0" placeholder="Buscar DNI o Apellidos..." value={busquedaTexto} onChange={(e) => setBusquedaTexto(e.target.value)} />
                      </div>
                    </div>
                    <div className="col-md-4">
                      <select className="form-select form-select-lg border-2 shadow-sm text-secondary fw-bold" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                        <option value="Todas">Todas las Cat.</option>
                        {['6', '8', '10', '12', '13', '14', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
                      </select>
                    </div>
                  </div>

                  {busquedaTexto.length > 1 && (
                    <div className="position-absolute w-100 bg-white border border-primary rounded-3 shadow-lg" style={{ top: '55px', zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}>
                      {resultadosBusqueda.length > 0 ? (
                        <ul className="list-group list-group-flush">
                          {resultadosBusqueda.map(alumno => (
                            <li key={alumno.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 border-bottom" style={{ cursor: 'pointer' }} onClick={() => seleccionarAlumno(alumno)}>
                              <div>
                                <div className="fw-black text-dark">{alumno.nombre} {alumno.apellido}</div>
                                <div className="small text-muted font-monospace"><i className="far fa-id-card me-1"></i>{alumno.dni}</div>
                              </div>
                              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 border border-primary">Cat. {alumno.categoria}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-4 text-center text-muted"><i className="fas fa-ghost fa-2x mb-2 opacity-50"></i><br/>No hay alumnos con esos datos.</div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-top">
                    <label className="form-label small fw-bold text-muted mb-2 text-uppercase">Búsqueda Manual</label>
                    <select className="form-select form-select-lg shadow-sm border-2 text-dark fw-medium" value="" onChange={(e) => { if(e.target.value) { seleccionarAlumno(alumnosBD.find(a => a.id === e.target.value)); } }}>
                      <option value="" disabled>Despliega para ver el directorio completo...</option>
                      {alumnosFiltrados.map(a => (<option key={a.id} value={a.id}>{a.apellido}, {a.nombre} (Cat. {a.categoria})</option>))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="animate__animated animate__fadeIn">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center">
                      <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow me-3" style={{ width:'60px', height:'60px', fontSize:'24px' }}>
                        {alumnoEncontrado.nombre.charAt(0)}{alumnoEncontrado.apellido.charAt(0)}
                      </div>
                      <div>
                        <h4 className="fw-black mb-0 text-dark" style={{letterSpacing: '-0.5px'}}>{alumnoEncontrado.nombre} {alumnoEncontrado.apellido}</h4>
                        <div className="text-muted small fw-bold font-monospace mt-1">DNI: {alumnoEncontrado.dni} | Cat. {alumnoEncontrado.categoria}</div>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill fw-bold" onClick={cancelarSeleccion}><i className="fas fa-sync-alt me-1"></i> Cambiar</button>
                  </div>

                  {/* ESCÁNER FINANCIERO DEL ALUMNO */}
                  <div className={`alert ${estaMoroso ? 'alert-danger border-danger' : 'alert-success border-success'} border-2 shadow-sm d-flex align-items-center mt-3`}>
                    <i className={`fas ${estaMoroso ? 'fa-exclamation-triangle' : 'fa-check-circle'} fa-2x me-3`}></i>
                    <div>
                      <h6 className="fw-bold mb-0 text-uppercase">{estaMoroso ? 'ALUMNO MOROSO' : 'ALUMNO AL DÍA'}</h6>
                      <small>{estaMoroso ? `Corte registrado: ${alumnoEncontrado.vencimientoMensualidad || 'N/A'}` : `Su próxima mensualidad vence el: ${alumnoEncontrado.vencimientoMensualidad}`}</small>
                    </div>
                  </div>

                  {/* ALERTA DE DEUDAS VIEJAS */}
                  {deudasAlumno.length > 0 && (
                    <div className="card border-warning shadow-sm mt-3 bg-warning bg-opacity-10">
                      <div className="card-body p-3">
                        <h6 className="fw-bold text-dark mb-2"><i className="fas fa-clipboard-list text-warning me-2"></i>Tiene saldos pendientes en el sistema:</h6>
                        <ul className="list-group list-group-flush rounded-3 overflow-hidden border">
                          {deudasAlumno.map(deuda => (
                            <li key={deuda.id} className="list-group-item d-flex justify-content-between align-items-center bg-white">
                              <span className="fw-medium text-dark small">{deuda.concepto}</span>
                              <div className="d-flex align-items-center gap-3">
                                <span className="fw-black text-danger">S/ {deuda.monto.toFixed(2)}</span>
                                <button className="btn btn-sm btn-warning fw-bold px-3 shadow-sm" onClick={() => agregarDeudaViejaAlCarrito(deuda)}>Sumar a Caja</button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PASO 2: AGREGAR PRODUCTOS */}
          <div className="card border-0 shadow-sm rounded-4" style={{ opacity: alumnoEncontrado ? 1 : 0.4, pointerEvents: alumnoEncontrado ? 'auto' : 'none', transition: 'all 0.3s' }}>
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
              <span className="badge bg-primary rounded-circle p-2 me-2">2</span>
              <h6 className="fw-bold mb-0 text-dark">Agregar Concepto a Cobrar</h6>
            </div>
            <div className="card-body p-4 bg-light bg-opacity-50">
              <div className="row g-3">
                
                <div className="col-md-6">
                  <label className="form-label fw-bold small text-secondary text-uppercase">Concepto</label>
                  <select className="form-select form-select-lg border-2 shadow-sm fw-bold text-dark" value={nuevoItem.concepto} onChange={handleConceptoChange}>
                    {Object.keys(catalogoPrecios).map(cat => (
                      <option key={cat} value={cat} className={cat.includes('BECADO') ? 'text-success fw-bold' : ''}>
                        {cat}
                      </option>
                    ))}
                    <option value="Otro">Otro Ingreso (Especificar)</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold small text-secondary text-uppercase">Costo (S/)</label>
                  <div className="input-group input-group-lg shadow-sm">
                    <span className="input-group-text bg-white fw-bold border-2">S/</span>
                    <input 
                      type="number" 
                      className={`form-control fw-black text-primary border-2 ps-2 ${nuevoItem.concepto.includes('BECADO') ? 'bg-light text-success' : ''}`}
                      value={nuevoItem.monto} 
                      onChange={(e) => setNuevoItem({...nuevoItem, monto: e.target.value})} 
                      min="0" 
                      disabled={nuevoItem.concepto.includes('BECADO')} // Bloqueamos el input si es beca
                    />
                  </div>
                </div>

                {/* MAGIA 2: Si elige Mensualidad o Beca, le obligamos a elegir el MES */}
                {nuevoItem.concepto.includes('Mensualidad') && (
                  <div className="col-md-12 animate__animated animate__fadeInDown animate__faster">
                    <label className={`form-label fw-bold small text-uppercase ${nuevoItem.concepto.includes('BECADO') ? 'text-success' : 'text-danger'}`}>
                      <i className="fas fa-calendar-alt me-1"></i> Mes a Aplicar {nuevoItem.concepto.includes('BECADO') && '(Gratuito)'}
                    </label>
                    <select className={`form-select border-2 shadow-sm fw-bold ${nuevoItem.concepto.includes('BECADO') ? 'border-success text-success bg-success bg-opacity-10' : 'border-danger text-danger bg-danger bg-opacity-10'}`} value={nuevoItem.mesEspecifico} onChange={(e) => setNuevoItem({...nuevoItem, mesEspecifico: e.target.value})}>
                      {mesesArray.map(mes => <option key={mes} value={mes}>{mes}</option>)}
                    </select>
                  </div>
                )}

                <div className="col-md-8">
                  <label className="form-label fw-bold small text-secondary text-uppercase">Nota Técnica (Opcional)</label>
                  <input type="text" className="form-control border-2 shadow-sm" placeholder={nuevoItem.concepto.includes('BECADO') ? "Ej: Beca por rendimiento deportivo..." : "Ej: Talla M, o Pago parcial de..."} value={nuevoItem.detalle} onChange={(e) => setNuevoItem({...nuevoItem, detalle: e.target.value})} />
                </div>
                
                <div className="col-md-4 d-flex align-items-end">
                  <button className={`btn w-100 fw-bold shadow border-0 ${nuevoItem.concepto.includes('BECADO') ? 'btn-success' : 'btn-dark'}`} style={{ padding: '11px' }} onClick={agregarAlCarrito}>
                    <i className="fas fa-plus me-2"></i> Añadir a Ticket
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            PANEL DERECHO: LA CAJA REGISTRADORA Y DESGLOSE
            ========================================================= */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-lg rounded-4 h-100 d-flex flex-column bg-dark text-white">
            
            <div className="card-header bg-transparent p-4 border-bottom border-secondary d-flex align-items-center">
              <span className="badge bg-primary rounded-circle p-2 me-2">3</span>
              <h5 className="fw-black mb-0 text-uppercase tracking-wider text-white">Resumen de Facturación</h5>
            </div>
            
            <div className="card-body p-4 flex-grow-1 bg-white text-dark rounded-bottom-4">
              
              {/* LISTA DEL CARRITO */}
              <div className="mb-4" style={{ minHeight: '150px' }}>
                <label className="fw-bold text-muted small text-uppercase mb-2 border-bottom w-100 pb-2">Ticket Actual</label>
                {carrito.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="fas fa-receipt fa-3x mb-2 opacity-25"></i>
                    <p className="mb-0 fw-medium">No hay servicios a cobrar.</p>
                  </div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {carrito.map((item, index) => (
                      <li key={item.id} className="list-group-item bg-transparent px-0 py-3 d-flex justify-content-between align-items-center">
                        <div>
                          <div className={`fw-black ${item.isDeudaVieja ? 'text-danger' : (item.concepto.includes('BECADO') ? 'text-success' : 'text-dark')}`}>
                            {index + 1}. {item.concepto}
                          </div>
                          {item.detalle && <div className="small text-muted font-monospace mt-1"><i className="fas fa-angle-right me-1"></i>{item.detalle}</div>}
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <span className={`fw-black fs-5 ${item.monto === 0 ? 'text-success' : 'text-dark'}`}>
                            {item.monto === 0 ? 'GRATIS' : `S/ ${parseFloat(item.monto).toFixed(2)}`}
                          </span>
                          <button className="btn btn-sm text-danger bg-danger bg-opacity-10 rounded-circle p-2" onClick={() => quitarDelCarrito(item.id)}><i className="fas fa-trash"></i></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-light p-4 rounded-4 mb-4 border shadow-inner text-center">
                <span className="fw-bold text-secondary text-uppercase d-block mb-1">Total a Pagar</span>
                <span className="display-4 fw-black text-primary">S/ {totalCarrito.toFixed(2)}</span>
              </div>

              {/* === MAGIA 3: CALCULADORA DE DESGLOSE VISUAL === */}
              <div className="mb-4">
                <label className="form-label fw-black text-dark mb-2 fs-6">Efectivo / Monto Entregado (S/)</label>
                <div className="input-group input-group-lg shadow-sm mb-3">
                  <span className="input-group-text bg-success text-white border-success fw-bold fs-4">S/</span>
                  <input 
                    type="number" 
                    className="form-control border-success fw-black text-success text-end pe-3" 
                    style={{ fontSize: '2rem' }}
                    value={montoEntregado} 
                    onChange={(e) => setMontoEntregado(e.target.value)}
                    min="0"
                    disabled={totalCarrito === 0 && carrito.length > 0} // Bloqueamos si es todo gratis
                  />
                </div>

                {/* Botones Rápidos (Desaparecen si el carrito es GRATIS) */}
                {totalCarrito > 0 && (
                  <div className="d-flex gap-2 mb-4">
                    <button className="btn btn-sm btn-outline-secondary fw-bold flex-fill" onClick={() => setMontoEntregado(totalCarrito.toString())}>Exacto</button>
                    <button className="btn btn-sm btn-outline-success fw-bold flex-fill" onClick={() => setMontoEntregado('50')}>S/ 50</button>
                    <button className="btn btn-sm btn-outline-success fw-bold flex-fill" onClick={() => setMontoEntregado('100')}>S/ 100</button>
                  </div>
                )}
                
                {/* Desglose de Operación */}
                {carrito.length > 0 && (
                  <div className="bg-light border rounded-4 p-3 shadow-sm">
                    <h6 className="fw-bold text-center text-muted mb-3 border-bottom pb-2">Auditoría de Operación</h6>
                    
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary fw-medium">Ingresa a Caja Fuerte:</span>
                      <strong className="text-success fs-6">+ S/ {(entregadoNum > totalCarrito ? totalCarrito : entregadoNum).toFixed(2)}</strong>
                    </div>

                    {vuelto > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-secondary fw-medium">Dar Vuelto Físico:</span>
                        <strong className="text-info fs-6">S/ {vuelto.toFixed(2)}</strong>
                      </div>
                    )}

                    {deudaGenerada > 0 && (
                      <div className="d-flex justify-content-between bg-danger bg-opacity-10 p-2 rounded-3 mt-2 border border-danger border-opacity-25">
                        <span className="text-danger fw-bold"><i className="fas fa-exclamation-triangle me-1"></i> Se anota Deuda:</span>
                        <strong className="text-danger fw-black fs-5">S/ {deudaGenerada.toFixed(2)}</strong>
                      </div>
                    )}

                    {totalCarrito === 0 ? (
                      <div className="text-center text-success fw-bold mt-2 pt-2 border-top border-success border-opacity-25">
                        <i className="fas fa-award me-1"></i> Operación Bonificada (Beca)
                      </div>
                    ) : entregadoNum >= totalCarrito ? (
                      <div className="text-center text-success fw-bold mt-2 pt-2 border-top border-success border-opacity-25">
                        <i className="fas fa-check-circle me-1"></i> Cobro Completo
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="row g-3 mb-4">
                <div className="col-6">
                  <label className="form-label fw-bold small text-muted text-uppercase">Método</label>
                  <select className="form-select border-2 fw-bold text-dark" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} disabled={entregadoNum === 0 && totalCarrito > 0}>
                    <option value="Efectivo">💵 Efectivo</option>
                    <option value="Yape/Plin">📱 Yape / Plin</option>
                    <option value="Transferencia">🏦 Transf.</option>
                    <option value="Aprobación Interna">✅ Beca/Convenio</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label fw-bold small text-muted text-uppercase">Fecha Trans.</label>
                  <input type="date" className="form-control border-2 fw-bold text-dark" value={fechaOperacion} onChange={(e) => setFechaOperacion(e.target.value)} />
                </div>
              </div>

              <button 
                className="btn btn-lg w-100 fw-black text-white shadow-lg py-3 rounded-4 d-flex justify-content-center align-items-center border-0" 
                style={{ 
                  backgroundColor: carrito.length > 0 ? (entregadoNum === 0 && totalCarrito > 0 ? '#ef4444' : '#10b981') : '#cbd5e1', 
                  cursor: carrito.length > 0 ? 'pointer' : 'not-allowed', 
                  transition: 'all 0.2s',
                  fontSize: '1.2rem'
                }}
                onClick={procesarCaja}
                disabled={carrito.length === 0 || !alumnoEncontrado || procesando}
              >
                {procesando ? (
                  <span className="spinner-border spinner-border-sm me-3"></span>
                ) : (
                  <i className={`fas ${entregadoNum === 0 && totalCarrito > 0 ? 'fa-clipboard-list' : 'fa-lock'} me-3`}></i>
                )}
                {procesando ? 'Procesando en Nube...' : (entregadoNum === 0 && totalCarrito > 0 ? 'REGISTRAR SOLO DEUDA' : 'CERRAR Y APROBAR')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==============================================================
          MODALES DE RESPUESTA
          ============================================================== */}
      {reciboGenerado && (
        <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ zIndex: 2000 }}>
          <div className="bg-white p-4 p-md-5 rounded-4 shadow-lg text-center mx-3 animate__animated animate__zoomIn" style={{ maxWidth: '400px' }}>
            <div className={`bg-${parseFloat(reciboGenerado.deudaCreada) > 0 && parseFloat(reciboGenerado.totalPagado) === 0 ? 'danger' : 'success'} bg-opacity-10 text-${parseFloat(reciboGenerado.deudaCreada) > 0 && parseFloat(reciboGenerado.totalPagado) === 0 ? 'danger' : 'success'} rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4`} style={{ width: '80px', height: '80px' }}>
              <i className={`fas ${parseFloat(reciboGenerado.deudaCreada) > 0 && parseFloat(reciboGenerado.totalPagado) === 0 ? 'fa-clipboard-list' : 'fa-check-circle'} fa-3x`}></i>
            </div>
            <h3 className="fw-black text-dark mb-2">¡Transacción Registrada!</h3>
            <p className="text-muted mb-4">La cuenta de <strong>{reciboGenerado.alumno}</strong> ha sido actualizada.</p>
            
            <div className="bg-light rounded-4 p-4 mb-4 text-start border shadow-sm">
              <div className="d-flex justify-content-between mb-3 pb-3 border-bottom">
                <span className="text-muted fw-bold small text-uppercase">N° Recibo / Comprobante</span>
                <span className="text-dark fw-black font-monospace">{reciboGenerado.numero}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-secondary fw-bold small text-uppercase">Ingreso en Caja</span>
                <span className="text-success fw-black fs-4">S/ {reciboGenerado.totalPagado}</span>
              </div>
              {parseFloat(reciboGenerado.deudaCreada) > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-danger border-opacity-25 bg-white p-2 rounded-3">
                  <span className="text-danger fw-bold small text-uppercase"><i className="fas fa-flag me-1"></i> Deuda Creada</span>
                  <span className="text-danger fw-black fs-5">S/ {reciboGenerado.deudaCreada}</span>
                </div>
              )}
            </div>
            
            <button className="btn btn-primary text-white fw-bold px-5 py-3 rounded-pill shadow-sm w-100" onClick={() => setReciboGenerado(null)}>
              Nueva Operación
            </button>
          </div>
        </div>
      )}

      {errorModal && (
        <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ zIndex: 2000 }}>
          <div className="bg-white p-4 p-md-5 rounded-4 shadow-lg text-center mx-3 animate__animated animate__shakeX" style={{ maxWidth: '400px' }}>
            <div className="bg-danger bg-opacity-10 text-danger rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4" style={{ width: '80px', height: '80px' }}>
              <i className="fas fa-exclamation-triangle fa-3x"></i>
            </div>
            <h4 className="fw-bold text-dark mb-3">Atención Cajero</h4>
            <p className="text-muted mb-4">{errorModal}</p>
            <button className="btn btn-dark fw-bold px-5 py-3 rounded-pill shadow-sm w-100" onClick={() => setErrorModal(null)}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrarPagos;