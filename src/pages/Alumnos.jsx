import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const Alumnos = () => {
  // === MANEJO DE FECHA LOCAL ===
  const obtenerFechaHoy = () => {
    const opciones = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
    const partes = new Intl.DateTimeFormat('es-PE', opciones).formatToParts(new Date());
    return `${partes.find(p => p.type === 'year').value}-${partes.find(p => p.type === 'month').value}-${partes.find(p => p.type === 'day').value}`;
  };

  const hoy = obtenerFechaHoy();

  const [alumnos, setAlumnos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [alumnoAEliminar, setAlumnoAEliminar] = useState(null);
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [ordenarPor, setOrdenarPor] = useState('reciente');
  
  const [cargando, setCargando] = useState(false); 
  const [archivoFoto, setArchivoFoto] = useState(null); 

  // === ESTADO INICIAL DEL FORMULARIO ===
  const [formData, setFormData] = useState({
    nombre: '', apellido: '', edad: '', categoria: '6', dni: '',
    fechaNacimiento: '', colegio: '', celular: '', distrito: 'Sechura', direccion: '', apoderado: '', foto: null,
    fechaInscripcion: hoy, 
    vencimientoMensualidad: hoy // Por defecto vence HOY para que nazca como "PENDIENTE"
  });

  const alumnosCollectionRef = collection(db, 'alumnos');

  useEffect(() => {
    const getAlumnos = async () => {
      try {
        const data = await getDocs(alumnosCollectionRef);
        setAlumnos(data.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
      } catch (error) { console.error("Error al cargar alumnos:", error); }
    };
    getAlumnos();
  }, []);

  const calcularEdad = (fechaNac) => {
    if (!fechaNac) return '';
    const hoyDate = new Date();
    const nacimiento = new Date(fechaNac);
    let edad = hoyDate.getFullYear() - nacimiento.getFullYear();
    const mes = hoyDate.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoyDate.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad.toString();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let nuevosDatos = { ...formData, [name]: value };
    
    if (name === 'fechaNacimiento') {
      nuevosDatos.edad = calcularEdad(value);
    }
    
    // LA REGLA DEL PENDIENTE: Si cambias la fecha de inscripción, el vencimiento toma ESA MISMA FECHA.
    // Esto asegura que el alumno empiece debiendo hasta que pase por "Caja".
    if (name === 'fechaInscripcion' && !modoEdicion) {
      nuevosDatos.vencimientoMensualidad = value;
    }
    
    setFormData(nuevosDatos);
  };
  
  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setArchivoFoto(file); 
      setFormData({ ...formData, foto: URL.createObjectURL(file) }); 
    }
  };

  const iniciarEdicion = (alumno) => {
    setFormData({
      ...alumno,
      fechaInscripcion: alumno.fechaInscripcion || hoy,
      vencimientoMensualidad: alumno.vencimientoMensualidad || hoy
    });
    setArchivoFoto(null); 
    setModoEdicion(true);
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFormulario = () => {
    setFormData({ 
      nombre: '', apellido: '', edad: '', categoria: '6', dni: '', fechaNacimiento: '', 
      colegio: '', celular: '', distrito: 'Sechura', direccion: '', apoderado: '', foto: null,
      fechaInscripcion: hoy, vencimientoMensualidad: hoy 
    });
    setArchivoFoto(null);
    setModoEdicion(false);
    setMostrarForm(false);
  };

  const convertirABase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    
    try {
      if (!modoEdicion) {
        const dniExiste = alumnos.some(a => a.dni === formData.dni);
        if (dniExiste) {
          alert("¡Atención! Este DNI ya está registrado en la base de datos.");
          setCargando(false);
          return;
        }
      }

      let urlFotoFinal = formData.foto; 
      if (archivoFoto) {
        if (archivoFoto.size > 800000) {
          alert("¡Pausa! La foto es muy pesada (máximo 800KB). Por favor, elige una más ligera.");
          setCargando(false);
          return;
        }
        urlFotoFinal = await convertirABase64(archivoFoto);
      }

      if (modoEdicion) {
        const alumnoDoc = doc(db, 'alumnos', formData.id);
        const datosAActualizar = { ...formData, foto: urlFotoFinal }; 
        delete datosAActualizar.id; 
        
        await updateDoc(alumnoDoc, datosAActualizar);
        setAlumnos(alumnos.map(a => a.id === formData.id ? { ...datosAActualizar, id: formData.id } : a));
      } else {
        const qrGenerado = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${formData.dni}`;
        
        // Al registrar, nace con la fecha de vencimiento igual a la de inscripción (Moroso automático)
        const nuevoAlumnoData = { 
          ...formData, 
          foto: urlFotoFinal, 
          qr: qrGenerado,
          createdAt: new Date() // Sello de tiempo seguro para futuras consultas
        };
        delete nuevoAlumnoData.id; 
        
        const docRef = await addDoc(alumnosCollectionRef, nuevoAlumnoData);
        setAlumnos([...alumnos, { ...nuevoAlumnoData, id: docRef.id }]);
      }
      resetFormulario();
    } catch (error) {
      console.error("Error guardando documento: ", error);
      alert("Hubo un error al guardar en Firebase.");
    } finally {
      setCargando(false);
    }
  };

  const confirmarEliminacion = async () => {
    try {
      const alumnoDoc = doc(db, 'alumnos', alumnoAEliminar.id);
      await deleteDoc(alumnoDoc);
      setAlumnos(alumnos.filter(a => a.id !== alumnoAEliminar.id));
      setAlumnoAEliminar(null);
    } catch (error) {
      console.error("Error al eliminar: ", error);
    }
  };

  const cerrarCarnet = () => setAlumnoSeleccionado(null);

  // === IMPRESIÓN DEL CARNET (MEDIDAS EXACTAS) ===
  const imprimirCarnetPVC = () => {
    const ventanaImpresion = window.open('', '_blank');
    const carnetFrontalHTML = document.getElementById('carnet-frontal-export').innerHTML;
    const carnetReversoHTML = document.getElementById('carnet-reverso-export').innerHTML;

    ventanaImpresion.document.write(`
      <html>
        <head>
          <title>Imprimir Carnet - FC Sechura</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Roboto:wght@400;700&display=swap');
            @page { size: A4; margin: 1cm; }
            body { font-family: 'Roboto', sans-serif; background: white; display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 0; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
            
            .carnet-id-horizontal { width: 8.54cm; height: 5.4cm; border-radius: 8px; overflow: hidden; display: flex; border: 1px solid #cbd5e1; position: relative; }
            .carnet-left { width: 35%; background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%) !important; color: white; padding: 5px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-right: 2px solid #00f2fe; }
            .carnet-right { width: 65%; background: #ffffff; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; }
            .carnet-foto-hz { width: 2.2cm; height: 2.2cm; border-radius: 50%; border: 2px solid #ffffff; object-fit: cover; margin-bottom: 5px; background-color: #64748b; }
            .data-label { font-size: 6px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 1px; }
            .data-value { font-size: 11px; font-weight: 900; color: #1e293b; margin-bottom: 4px; text-transform: uppercase; line-height: 1; }
            .carnet-qr-hz { width: 1.8cm; height: 1.8cm; border: 1px solid #e2e8f0; padding: 2px; background: white; border-radius: 4px; }
            .reverso-container { background: linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%) !important; display: flex; flex-direction: column; }
          </style>
        </head>
        <body>
          <div class="carnet-id-horizontal">${carnetFrontalHTML}</div>
          <div class="carnet-id-horizontal reverso-container">${carnetReversoHTML}</div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
        </body>
      </html>
    `);
    ventanaImpresion.document.close();
  };  

  const alumnosProcesados = alumnos
    .filter((alumno) => {
      const termino = busqueda.toLowerCase();
      const coincideBusqueda = alumno.nombre.toLowerCase().includes(termino) || alumno.apellido.toLowerCase().includes(termino) || alumno.dni.includes(termino);
      const coincideCategoria = filtroCategoria === 'Todas' || alumno.categoria === filtroCategoria;
      return coincideBusqueda && coincideCategoria;
    })
    .sort((a, b) => {
      if (ordenarPor === 'az') return a.nombre.localeCompare(b.nombre);
      if (ordenarPor === 'za') return b.nombre.localeCompare(a.nombre);
      if (ordenarPor === 'edad_asc') return parseInt(a.edad) - parseInt(b.edad);
      if (ordenarPor === 'edad_desc') return parseInt(b.edad) - parseInt(a.edad);
      return 0; 
    });

  return (
    <div className="container py-4 mb-5">
      <div className="hide-on-print">
        <div className="row mb-4 align-items-center">
          <div className="col-12 col-md-5">
            <h1 className="fw-bold" style={{ color: 'var(--fc-azul)' }}>Directorio de Alumnos</h1>
            <p className="text-muted">Gestión técnica y administrativa FC Sechura</p>
          </div>
          <div className="col-12 col-md-7 text-md-end d-flex gap-2 justify-content-md-end flex-wrap">
            <button className={`btn btn-lg rounded-pill px-4 fw-bold shadow-sm ${mostrarForm ? 'btn-light border-2' : 'btn-turquesa'}`} onClick={mostrarForm ? resetFormulario : () => setMostrarForm(true)}>
              {mostrarForm ? <><i className="fas fa-times me-2"></i> Cancelar</> : <><i className="fas fa-user-plus me-2"></i> Registrar Alumno</>}
            </button>
          </div>
        </div>

        {mostrarForm ? (
          <div className="card border-0 shadow-lg p-3 p-lg-4 animate__animated animate__fadeIn">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <h5 className="mb-4 fw-bold text-uppercase" style={{ color: modoEdicion ? '#f59e0b' : 'var(--fc-turquesa)', letterSpacing: '1px' }}>
                  {modoEdicion ? <><i className="fas fa-edit me-2"></i> Editando Ficha de Alumno</> : 'Ficha de Registro'}
                </h5>
                
                <h6 className="fw-bold text-secondary mb-3 border-bottom pb-2">1. Datos Personales</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-muted">Nombres</label>
                    <input type="text" className="form-control shadow-sm" name="nombre" value={formData.nombre} onChange={handleChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-muted">Apellidos</label>
                    <input type="text" className="form-control shadow-sm" name="apellido" value={formData.apellido} onChange={handleChange} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-muted">DNI (Código QR)</label>
                    <input type="text" className="form-control shadow-sm" name="dni" value={formData.dni} onChange={handleChange} required maxLength="8" disabled={modoEdicion} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-muted">Fecha Nacimiento</label>
                    <input type="date" className="form-control shadow-sm" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-muted">Edad Calculada</label>
                    <input type="text" className="form-control shadow-sm bg-light fw-bold text-secondary" name="edad" value={formData.edad} readOnly placeholder="0" />
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mb-3 border-bottom pb-2">2. Residencia y Contacto</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <label className="form-label fw-bold small text-muted">Celular (Apoderado)</label>
                    <input type="text" className="form-control shadow-sm" name="celular" value={formData.celular} onChange={handleChange} required />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-bold small text-muted">Distrito</label>
                    <input type="text" className="form-control shadow-sm" name="distrito" value={formData.distrito} onChange={handleChange} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold small text-muted">Dirección Física</label>
                    <input type="text" className="form-control shadow-sm" name="direccion" value={formData.direccion} onChange={handleChange} required />
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mb-3 border-bottom pb-2">3. Académico y Responsable</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-5">
                    <label className="form-label fw-bold small text-muted">Institución Educativa</label>
                    <input type="text" className="form-control shadow-sm" name="colegio" value={formData.colegio} onChange={handleChange} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold small text-muted">Categoría Deportiva</label>
                    <select className="form-select shadow-sm" name="categoria" value={formData.categoria} onChange={handleChange}>
                      {['6', '8', '10', '12', '13', '14', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-bold small text-muted">Nombre del Apoderado</label>
                    <input type="text" className="form-control shadow-sm" name="apoderado" value={formData.apoderado} onChange={handleChange} required />
                  </div>
                </div>

                <h6 className="fw-bold text-primary mb-3 border-bottom pb-2">4. Parámetros de Facturación</h6>
                <div className="row g-3 mb-4 bg-primary bg-opacity-10 p-3 rounded-3 border border-primary border-opacity-25">
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-primary small">Fecha de Inscripción (Manual/Automática)</label>
                    <input type="date" className="form-control border-primary shadow-sm" name="fechaInscripcion" value={formData.fechaInscripcion} onChange={handleChange} required />
                    {!modoEdicion && <small className="text-muted d-block mt-2 fw-medium"><i className="fas fa-info-circle me-1"></i> Al registrar un nuevo alumno, el estado será <strong className="text-danger">PENDIENTE</strong> hasta que registre su primer pago en Caja.</small>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-danger small">Vencimiento del Mes (Corte)</label>
                    <input type="date" className="form-control border-danger fw-bold shadow-sm" name="vencimientoMensualidad" value={formData.vencimientoMensualidad} onChange={handleChange} required />
                    <small className="text-muted d-block mt-2 fw-medium"><i className="fas fa-cogs me-1"></i> Este campo se actualiza automáticamente sumando 1 mes cuando se registra un pago en Caja.</small>
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mb-3 border-bottom pb-2">5. Perfil Biométrico (Foto)</h6>
                <div className="row g-3">
                  <div className="col-md-12">
                    <label className="form-label fw-bold small text-muted">Adjuntar Fotografía (Límite 800KB)</label>
                    <input type="file" className="form-control shadow-sm border-2" accept="image/*" onChange={handleFileChange} /> 
                  </div>
                </div>

                <div className="mt-5 text-end border-top pt-4">
                  <button type="submit" disabled={cargando} className={`btn btn-lg px-5 fw-bold text-white rounded-pill shadow ${modoEdicion ? 'btn-warning' : 'btn-primary'}`}>
                    {cargando ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className={modoEdicion ? "fas fa-sync-alt me-2" : "fas fa-save me-2"}></i>}
                    {modoEdicion ? 'Actualizar Ficha' : 'Generar Registro'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div className="card border-0 shadow-sm mb-4 bg-white rounded-4 p-3">
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-5">
                  <div className="input-group">
                    <span className="input-group-text bg-light border-0 text-muted"><i className="fas fa-search"></i></span>
                    <input type="text" className="form-control bg-light border-0 shadow-none ps-2" placeholder="Buscar por nombre, apellido o DNI..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                  </div>
                </div>
                <div className="col-12 col-sm-6 col-md-3">
                  <div className="d-flex align-items-center">
                    <i className="fas fa-filter text-muted me-2"></i>
                    <select className="form-select border-0 bg-light fw-bold text-secondary shadow-sm" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                      <option value="Todas">Todas las Categorías</option>
                      {['6', '8', '10', '12', '13', '14', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-12 col-sm-6 col-md-4">
                  <div className="d-flex align-items-center justify-content-md-end">
                    <span className="small fw-bold text-muted me-2 text-nowrap">Ordenar por:</span>
                    <select className="form-select border-0 bg-light fw-bold shadow-sm" style={{ borderRadius: '10px' }} value={ordenarPor} onChange={(e) => setOrdenarPor(e.target.value)}>
                      <option value="reciente">Nuevos Ingresos</option>
                      <option value="az">A - Z</option>
                      <option value="za">Z - A</option>
                      <option value="edad_asc">Menores Primero</option>
                      <option value="edad_desc">Mayores Primero</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm overflow-hidden rounded-4">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light border-bottom">
                    <tr>
                      <th className="ps-4 py-3 text-uppercase small fw-bold text-secondary">Jugador</th>
                      <th className="py-3 text-uppercase small fw-bold text-secondary">DNI</th>
                      <th className="py-3 text-uppercase small fw-bold text-center text-secondary">Categoría</th>
                      <th className="py-3 text-uppercase small fw-bold text-center text-secondary">Estado de Cuenta</th>
                      <th className="pe-4 py-3 text-uppercase small fw-bold text-end text-secondary">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnosProcesados.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-5 text-muted">
                          <i className="fas fa-folder-open fa-3x mb-3 opacity-25"></i>
                          <p className="mb-0 fw-medium">Directorio vacío o sin coincidencias.</p>
                        </td>
                      </tr>
                    ) : (
                      alumnosProcesados.map((alumno) => {
                        const d = new Date();
                        const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        const vencimiento = alumno.vencimientoMensualidad || '2000-01-01';
                        const estaEnDeuda = hoyLocal >= vencimiento;

                        return (
                          <tr key={alumno.id}>
                            <td className="ps-4">
                              <div className="d-flex align-items-center">
                                {alumno.foto ? (
                                  <img src={alumno.foto} className="rounded-circle me-3 border border-2 border-white shadow-sm" style={{ width: '45px', height: '45px', objectFit: 'cover' }} alt="Foto" />
                                ) : (
                                  <div className="rounded-circle me-3 bg-secondary text-white d-flex align-items-center justify-content-center fw-bold shadow-sm" style={{ width: '45px', height: '45px' }}>
                                    {alumno.nombre.charAt(0)}{alumno.apellido.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <div className="fw-black text-dark" style={{ letterSpacing: '-0.3px' }}>{alumno.nombre} {alumno.apellido}</div>
                                  <div className="small text-muted font-monospace mt-1">Inscrito: {alumno.fechaInscripcion}</div>
                                </div>
                              </div>
                            </td>
                            <td className="text-muted fw-medium font-monospace">{alumno.dni}</td>
                            <td className="text-center">
                              <span className="badge rounded-pill px-3 py-2 fw-bold" style={{ backgroundColor: 'var(--fc-celeste)', color: 'var(--fc-azul)' }}>Cat. {alumno.categoria}</span>
                            </td>
                            <td className="text-center">
                              {estaEnDeuda ? (
                                <div className="d-flex flex-column align-items-center">
                                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger px-3 py-1 rounded-pill shadow-sm"><i className="fas fa-exclamation-circle me-1"></i> PENDIENTE</span>
                                  <small className="text-danger fw-bold mt-1" style={{fontSize: '0.70rem'}}>Corte: {alumno.vencimientoMensualidad}</small>
                                </div>
                              ) : (
                                <div className="d-flex flex-column align-items-center">
                                  <span className="badge bg-success bg-opacity-10 text-success border border-success px-3 py-1 rounded-pill shadow-sm"><i className="fas fa-check-circle me-1"></i> AL DÍA</span>
                                  <small className="text-muted fw-bold mt-1" style={{fontSize: '0.70rem'}}>Vence: {alumno.vencimientoMensualidad}</small>
                                </div>
                              )}
                            </td>
                            
                            <td className="pe-4">
                              <div className="d-flex justify-content-end gap-2">
                                <Link to="/perfil-alumno" state={{ alumno: alumno }} className="btn btn-sm btn-light border shadow-sm text-success" title="Panel Gerencial del Alumno">
                                  <i className="fas fa-chart-pie"></i>
                                </Link>
                                <button className="btn btn-sm btn-light border shadow-sm text-primary" title="Imprimir Carnet" onClick={() => setAlumnoSeleccionado(alumno)}>
                                  <i className="fas fa-id-card"></i>
                                </button>
                                <button className="btn btn-sm btn-light border shadow-sm text-warning" title="Modificar Ficha" onClick={() => iniciarEdicion(alumno)}>
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button className="btn btn-sm btn-light border shadow-sm text-danger" title="Dar de Baja" onClick={() => setAlumnoAEliminar(alumno)}>
                                  <i className="fas fa-trash-alt"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div> 

      {/* MODAL ELIMINAR */}
      {alumnoAEliminar && (
        <div className="modal-overlay d-flex align-items-center justify-content-center btn-no-print" style={{ zIndex: 2000 }}>
          <div className="bg-white p-4 p-md-5 rounded-4 shadow-lg text-center mx-3 animate__animated animate__bounceIn" style={{ maxWidth: '400px' }}>
            <div className="bg-danger bg-opacity-10 text-danger rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4" style={{ width: '80px', height: '80px' }}>
              <i className="fas fa-user-times fa-3x"></i>
            </div>
            <h3 className="fw-black text-dark mb-2">¿Dar de baja?</h3>
            <p className="text-muted mb-4">
              Eliminarás permanentemente el registro de <strong className="text-danger">{alumnoAEliminar.nombre}</strong>. Sus datos financieros podrían perder contexto.
            </p>
            <div className="d-flex gap-3 justify-content-center">
              <button className="btn btn-light fw-bold px-4 py-2 border shadow-sm w-50" onClick={() => setAlumnoAEliminar(null)}>Cancelar</button>
              <button className="btn btn-danger fw-bold px-4 py-2 shadow-sm w-50" onClick={confirmarEliminacion}>Sí, Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CARNET PVC */}
      {alumnoSeleccionado && (
        <div className="modal-overlay d-flex flex-column align-items-center justify-content-center" onClick={cerrarCarnet} style={{ zIndex: 1500 }}>
          
          <div onClick={(e) => e.stopPropagation()} className="d-flex flex-column gap-3 align-items-center bg-light p-4 p-md-5 rounded-4 shadow-lg position-relative animate__animated animate__zoomIn" style={{ maxWidth: '95%', overflowX: 'auto' }}>
            
            <button className="btn btn-danger position-absolute top-0 end-0 m-3 rounded-circle shadow" onClick={cerrarCarnet}><i className="fas fa-times"></i></button>
            <h5 className="fw-black text-secondary mb-2"><i className="fas fa-print me-2"></i>Vista de Impresión Oficial (CR80)</h5>

            <div id="carnet-frontal-export" className="carnet-id-horizontal shadow-lg" style={{ width: '8.54cm', height: '5.4cm', display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', background: 'white' }}>
              <div className="carnet-left" style={{ width: '35%', background: 'linear-gradient(135deg, #1e3a8a, #0f172a)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5px', borderRight: '2px solid #00f2fe' }}>
                <h6 style={{ margin: '0 0 5px 0', fontSize: '10px', fontWeight: '900', color: 'white', fontFamily: 'Montserrat, sans-serif' }}>FC SECHURA</h6>
                {alumnoSeleccionado.foto ? (
                  <img src={alumnoSeleccionado.foto} style={{ width: '2.2cm', height: '2.2cm', borderRadius: '50%', border: '2px solid white', objectFit: 'cover' }} alt="Foto" />
                ) : (
                  <div style={{ width: '2.2cm', height: '2.2cm', borderRadius: '50%', background: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '24px', border: '2px solid white' }}>
                    {alumnoSeleccionado.nombre.charAt(0)}
                  </div>
                )}
              </div>
              <div className="carnet-right" style={{ width: '65%', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'white' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '2px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold' }}>DOC. DE IDENTIDAD DEPORTIVO</span>
                </div>
                <div>
                  <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Apellidos</div>
                  <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e3a8a', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', lineHeight: '1' }}>{alumnoSeleccionado.apellido}</div>
                  <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px' }}>Nombres</div>
                  <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', lineHeight: '1' }}>{alumnoSeleccionado.nombre}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '5px' }}>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 'bold' }}>DNI</div>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b' }}>{alumnoSeleccionado.dni}</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <div>
                        <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 'bold' }}>EDAD</div>
                        <div style={{ fontSize: '9px', fontWeight: '900', color: '#1e293b' }}>{alumnoSeleccionado.edad} A.</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 'bold' }}>CATEGORÍA</div>
                        <div style={{ fontSize: '10px', fontWeight: '900', color: '#00f2fe' }}>{alumnoSeleccionado.categoria}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <img src={alumnoSeleccionado.qr} style={{ width: '1.8cm', height: '1.8cm', border: '1px solid #e2e8f0', padding: '2px', borderRadius: '4px' }} alt="QR" />
                  </div>
                </div>
              </div>
            </div>

            <div id="carnet-reverso-export" className="shadow-lg mt-2" style={{ width: '8.54cm', height: '5.4cm', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
              <div style={{ background: '#1e3a8a', color: 'white', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '1.2cm' }}>
                <span style={{ fontSize: '10px', fontWeight: '900', fontFamily: 'Montserrat, sans-serif' }}>INFO. DE EMERGENCIA</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>FC SECHURA</span>
              </div>
              <div style={{ padding: '8px 15px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold' }}>APODERADO RESPONSABLE:</div>
                  <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: 'bold' }}>{alumnoSeleccionado.apoderado}</div>
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold' }}>CELULAR DE CONTACTO:</div>
                  <div style={{ fontSize: '10px', color: '#1e3a8a', fontWeight: '900' }}>{alumnoSeleccionado.celular}</div>
                </div>
                <div>
                  <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold' }}>DIRECCIÓN REGISTRADA:</div>
                  <div style={{ fontSize: '8px', color: '#0f172a', fontWeight: 'bold' }}>{alumnoSeleccionado.direccion} - {alumnoSeleccionado.distrito}</div>
                </div>
              </div>
              <div style={{ background: '#f1f5f9', padding: '4px', textAlign: 'center', fontSize: '6px', color: '#475569', borderTop: '1px solid #e2e8f0' }}>
                Carnet personal e intransferible. Uso obligatorio para entrenamientos y torneos oficiales. En caso de pérdida, reportar a la administración de FC Sechura.
              </div>
              <div style={{ background: '#0f172a', color: '#00f2fe', textAlign: 'center', fontSize: '7px', fontWeight: 'bold', letterSpacing: '2px', padding: '3px 0' }}>
                DISCIPLINA | HONOR | TALENTO
              </div>
            </div>

            <div className="w-100 mt-4 text-center">
              <button className="btn btn-lg btn-success fw-bold shadow-lg px-5 rounded-pill" onClick={imprimirCarnetPVC}>
                <i className="fas fa-print me-2"></i> Mandar a Impresión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alumnos;