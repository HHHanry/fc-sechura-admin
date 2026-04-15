import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const Historial = () => {
  const obtenerFechaPeruana = () => {
    const opciones = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
    const partes = new Intl.DateTimeFormat('es-PE', opciones).formatToParts(new Date());
    const dia = partes.find(p => p.type === 'day').value;
    const mes = partes.find(p => p.type === 'month').value;
    const anio = partes.find(p => p.type === 'year').value;
    return `${anio}-${mes}-${dia}`;
  };

  const hoyPeru = obtenerFechaPeruana();

  const [registros, setRegistros] = useState([]);
  const [alumnosBD, setAlumnosBD] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState(hoyPeru);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroAlumnoId, setFiltroAlumnoId] = useState('Todos'); 
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [cargando, setCargando] = useState(false);
  const [registroAEditar, setRegistroAEditar] = useState(null);
  const [registroAEliminar, setRegistroAEliminar] = useState(null);

  useEffect(() => {
    const cargarHistorialYAlumnos = async () => {
      setCargando(true);
      try {
        if (alumnosBD.length === 0) {
          const alumnosSnap = await getDocs(collection(db, 'alumnos'));
          const listaAlumnos = alumnosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          listaAlumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));
          setAlumnosBD(listaAlumnos);
        }

        const [anio, mes, dia] = filtroFecha.split('-');
        const fechaBusqueda = `${dia}/${mes}/${anio}`;

        const q = query(
          collection(db, 'asistencias'),
          where('fecha', '==', fechaBusqueda)
        );

        const querySnapshot = await getDocs(q);
        const listaRegistros = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setRegistros(listaRegistros);
      } catch (error) {
        console.error("Error cargando historial:", error);
      } finally {
        setCargando(false);
      }
    };

    if (filtroFecha) cargarHistorialYAlumnos();
  }, [filtroFecha]); 

  const opcionesAlumnos = alumnosBD.filter(a => 
    filtroCategoria === 'Todas' ? true : a.categoria === filtroCategoria
  );

  useEffect(() => {
    setFiltroAlumnoId('Todos');
  }, [filtroCategoria]);

  const guardarEdicion = async (e) => {
    e.preventDefault();
    try {
      const asistenciaDoc = doc(db, 'asistencias', registroAEditar.id);
      const nuevosDatos = {
        estado: registroAEditar.estado,
        pagoCancha: registroAEditar.estado === 'Faltó' ? false : registroAEditar.pagoCancha,
        montoCancha: (registroAEditar.estado !== 'Faltó' && registroAEditar.pagoCancha) ? 3 : 0
      };
      await updateDoc(asistenciaDoc, nuevosDatos);
      setRegistros(registros.map(r => r.id === registroAEditar.id ? { ...r, ...nuevosDatos } : r));
      setRegistroAEditar(null);
    } catch (error) {
      console.error("Error al actualizar:", error);
    }
  };

  const ejecutarBorrado = async () => {
    try {
      await deleteDoc(doc(db, 'asistencias', registroAEliminar.id));
      setRegistros(registros.filter(r => r.id !== registroAEliminar.id));
      setRegistroAEliminar(null);
    } catch (error) {
      console.error("Error eliminando:", error);
    }
  };

  const registrosFiltrados = registros.filter(registro => {
    const coincideCategoria = filtroCategoria === 'Todas' || registro.categoria === filtroCategoria;
    const coincideEstado = filtroEstado === 'Todos' || registro.estado === filtroEstado;
    const coincideAlumno = filtroAlumnoId === 'Todos' || registro.alumnoId === filtroAlumnoId; 
    return coincideCategoria && coincideEstado && coincideAlumno;
  });

  const totalAsistencias = registrosFiltrados.filter(r => r.estado === 'Asistió').length;
  const totalTardanzas = registrosFiltrados.filter(r => r.estado === 'Tarde').length;
  const totalFaltas = registrosFiltrados.filter(r => r.estado === 'Faltó').length;
  const totalCajaChica = registrosFiltrados.filter(r => r.pagoCancha).length * 3;

  // === 1. NUEVA FUNCIÓN exportarPDF (IGUAL QUE EN VerPagos) ===
  const exportarPDF = () => {
    const ventanaImpresion = window.open('', '_blank');
    let html = `
      <html>
      <head>
        <title>Reporte de Asistencia - FC Sechura</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
          .title-section h1 { color: #1e3a8a; margin: 0; font-size: 24px; text-transform: uppercase; }
          .title-section p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
          .resumen { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
          .resumen-box { padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-size: 14px; flex: 1; text-align: center; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background-color: #1e3a8a; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-align: center; }
          .text-success { color: #10b981; font-weight: bold; }
          .text-warning { color: #d97706; font-weight: bold; }
          .text-danger { color: #ef4444; font-weight: bold; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-section">
            <h1>Reporte de Asistencia</h1>
            <p>Fecha: <strong>${filtroFecha}</strong> | Categoría: ${filtroCategoria}</p>
          </div>
          <div style="text-align: right;">
            <h3 style="margin:0; color:#1e3a8a;">S/ ${totalCajaChica.toFixed(2)}</h3>
            <p style="margin:0; font-size:12px; color:#64748b;">Caja Chica (Cancha)</p>
          </div>
        </div>

        <div class="resumen">
          <div class="resumen-box"><strong class="text-success">Presentes:</strong> ${totalAsistencias}</div>
          <div class="resumen-box"><strong class="text-warning">Tardanzas:</strong> ${totalTardanzas}</div>
          <div class="resumen-box"><strong class="text-danger">Faltas:</strong> ${totalFaltas}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>DNI</th>
              <th>Categoría</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Cancha (S/3)</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (registrosFiltrados.length === 0) {
      html += `<tr><td colspan="7" class="text-center" style="padding: 20px; color: #64748b;">No hay registros para mostrar.</td></tr>`;
    } else {
      registrosFiltrados.forEach(r => {
        let colorEstado = '';
        if (r.estado === 'Asistió') colorEstado = 'text-success';
        else if (r.estado === 'Tarde') colorEstado = 'text-warning';
        else colorEstado = 'text-danger';

        let textoCancha = r.estado === 'Faltó' ? '-' : (r.pagoCancha ? 'Pagó' : 'No Pagó');

        html += `
          <tr>
            <td><strong>${r.nombre}</strong></td>
            <td class="text-center">${r.dni}</td>
            <td class="text-center">Cat. ${r.categoria}</td>
            <td class="text-center">${r.horaIngreso}</td>
            <td class="text-center">${r.horaSalida}</td>
            <td class="text-center">${textoCancha}</td>
            <td class="text-center ${colorEstado}">${r.estado}</td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
        </table>
        <div style="margin-top: 30px; text-align: center; color: #94a3b8; font-size: 10px;">
          Documento generado por el Sistema de Gestión Administrativa FC Sechura.
        </div>
        <script>
          window.onload = () => { 
            window.print(); 
            window.close(); 
          };
        </script>
      </body>
      </html>
    `;

    ventanaImpresion.document.write(html);
    ventanaImpresion.document.close();
  };

  // === 2. EXCEL (Se mantiene tu versión original) ===
  const exportarExcel = () => {
    const titulo = `Reporte de Asistencia - FC Sechura - ${filtroFecha}`;
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>
        table { border-collapse: collapse; width: 100%; font-family: Arial; }
        th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #000; }
        td { border: 1px solid #000; text-align: center; }
      </style></head>
      <body><h2>${titulo}</h2><table><thead><tr><th>ALUMNO</th><th>DNI</th><th>CATEGORÍA</th><th>INGRESO</th><th>SALIDA</th><th>CANCHA (S/3)</th><th>ESTADO</th></tr></thead><tbody>`;

    registrosFiltrados.forEach(r => {
      html += `<tr><td>${r.nombre}</td><td>${r.dni}</td><td>Cat. ${r.categoria}</td><td>${r.horaIngreso}</td><td>${r.horaSalida}</td><td>${r.pagoCancha ? 'Pagó S/3' : 'No Pagó'}</td><td>${r.estado}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Asistencia_FCSechura_${filtroFecha}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container py-4 mb-5">
      <div className="row mb-4 align-items-center">
        <div className="col-12 col-md-6">
          <h1 className="fw-bold" style={{ color: 'var(--fc-azul)' }}>Historial de Asistencia</h1>
          <p className="text-muted">Consulta registros históricos almacenados en la nube.</p>
        </div>
        <div className="col-12 col-md-6 text-md-end no-print">
          <div className="d-flex gap-2 justify-content-md-end flex-wrap">
            <button className="btn btn-outline-danger shadow-sm fw-bold px-4 rounded-pill border-2" onClick={exportarPDF}>
              <i className="fas fa-file-pdf me-2"></i> Reporte PDF
            </button>
            <button className="btn btn-light shadow-sm fw-bold px-4 rounded-pill text-secondary border" onClick={exportarExcel}>
              <i className="fas fa-file-excel me-2 text-success"></i> Excel
            </button>
          </div>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Presentes', val: totalAsistencias, color: 'success', icon: 'check-circle' },
          { label: 'Tardanzas', val: totalTardanzas, color: 'warning', icon: 'clock' },
          { label: 'Faltas', val: totalFaltas, color: 'danger', icon: 'times-circle' },
          { label: 'Cancha (S/3)', val: `S/. ${totalCajaChica.toFixed(2)}`, color: 'info', icon: 'coins' }
        ].map((item, i) => (
          <div className="col-md-3" key={i}>
            <div className={`card border-0 shadow-sm rounded-4 bg-${item.color} bg-opacity-10`}>
              <div className="card-body d-flex align-items-center">
                <div className={`bg-${item.color} text-white rounded-circle d-flex justify-content-center align-items-center me-3`} style={{ width: '45px', height: '45px' }}>
                  <i className={`fas fa-${item.icon} fs-5`}></i>
                </div>
                <div>
                  <h6 className={`text-${item.color} fw-bold mb-0 small text-uppercase`}>{item.label}</h6>
                  <h3 className="fw-black text-dark mb-0">{item.val}</h3>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div className="card border-0 shadow-sm mb-4 bg-white rounded-4 p-3 no-print">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label small fw-bold text-muted mb-1">Fecha de Consulta</label>
            <input type="date" className="form-control shadow-sm border-0 bg-light" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} />
          </div>
          <div className="col-12 col-md-2">
            <label className="form-label small fw-bold text-muted mb-1">Categoría</label>
            <select className="form-select shadow-sm border-0 bg-light" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="Todas">Todas las Categorías</option>
              {['6', '8', '10', '12', '13', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small fw-bold text-muted mb-1">Alumno Específico</label>
            <select className="form-select shadow-sm border-0 bg-light fw-medium text-azul" value={filtroAlumnoId} onChange={(e) => setFiltroAlumnoId(e.target.value)}>
              <option value="Todos">Todos los alumnos</option>
              {opcionesAlumnos.map(a => (
                <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-bold text-muted mb-1">Estado</label>
            <select className="form-select shadow-sm border-0 bg-light" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="Todos">Todos los Estados</option>
              <option value="Asistió">Asistió</option>
              <option value="Tarde">Tardanza</option>
              <option value="Faltó">Falta</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="card border-0 shadow-sm overflow-hidden rounded-4">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-center">
            <thead className="bg-light">
              <tr style={{ borderBottom: '2px solid var(--fc-celeste)' }}>
                <th className="ps-4 py-3 text-start">Alumno</th>
                <th className="py-3">Categoría</th>
                <th className="py-3">Ingreso / Salida</th>
                <th className="py-3">Cancha</th>
                <th className="py-3">Estado</th>
                <th className="pe-4 py-3 text-end no-print">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan="6" className="py-5 text-center"><div className="spinner-border text-primary"></div></td></tr>
              ) : registrosFiltrados.length === 0 ? (
                <tr><td colSpan="6" className="py-5 text-muted text-center">No se encontraron registros.</td></tr>
              ) : (
                registrosFiltrados.map((r) => (
                  <tr key={r.id}>
                    <td className="ps-4 text-start">
                      <div className="fw-bold text-dark">{r.nombre}</div>
                      <div className="small text-muted font-monospace">DNI: {r.dni}</div>
                    </td>
                    <td><span className="badge rounded-pill bg-light text-azul border px-3">Cat. {r.categoria}</span></td>
                    <td className="small font-monospace">
                      {r.horaIngreso} | <span className={r.horaSalida === '--:--' ? 'text-muted' : 'text-danger'}>{r.horaSalida}</span>
                    </td>
                    <td>
                      <span className={`small fw-bold px-2 py-1 rounded ${r.pagoCancha ? 'bg-success bg-opacity-10 text-success' : 'bg-light text-muted border'}`}>
                        {r.pagoCancha ? 'Pagó S/3' : 'No Pagó'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge rounded-pill px-3 py-2 fw-bold w-100 ${r.estado === 'Asistió' ? 'bg-success' : r.estado === 'Tarde' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                        {r.estado}
                      </span>
                    </td>
                    <td className="pe-4 text-end no-print">
                      <div className="d-flex justify-content-end gap-2">
                        <button className="btn btn-sm btn-light border shadow-sm text-primary" onClick={() => setRegistroAEditar(r)} title="Editar">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="btn btn-sm btn-light border shadow-sm text-danger" onClick={() => setRegistroAEliminar(r)} title="Eliminar">
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDICIÓN */}
      {registroAEditar && (
        <div className="modal-overlay d-flex align-items-center justify-content-center no-print" style={{ zIndex: 2000 }}>
          <div className="bg-white p-4 rounded-4 shadow-lg mx-3 animate__animated animate__fadeIn" style={{ width: '100%', maxWidth: '400px' }}>
            <h5 className="fw-bold mb-4 border-bottom pb-2">Corregir Registro</h5>
            <form onSubmit={guardarEdicion}>
              <div className="mb-3">
                <label className="form-label fw-bold small text-muted">Estado</label>
                <select className="form-select" value={registroAEditar.estado} onChange={(e) => setRegistroAEditar({...registroAEditar, estado: e.target.value})}>
                  <option value="Asistió">Asistió</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Faltó">Faltó</option>
                </select>
              </div>
              {registroAEditar.estado !== 'Faltó' && (
                <div className="mb-4">
                  <label className="form-label fw-bold small text-muted">Caja Chica (S/3)</label>
                  <select className="form-select" value={registroAEditar.pagoCancha ? 'true' : 'false'} onChange={(e) => setRegistroAEditar({...registroAEditar, pagoCancha: e.target.value === 'true'})}>
                    <option value="true">Sí Pagó (S/ 3.00)</option>
                    <option value="false">No Pagó</option>
                  </select>
                </div>
              )}
              <div className="d-flex gap-2 justify-content-end">
                <button type="button" className="btn btn-light border px-4" onClick={() => setRegistroAEditar(null)}>Cancelar</button>
                <button type="submit" className="btn btn-warning px-4 fw-bold shadow-sm">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {registroAEliminar && (
        <div className="modal-overlay d-flex align-items-center justify-content-center no-print" style={{ zIndex: 2000 }}>
          <div className="bg-white p-4 rounded-4 shadow-lg text-center mx-3 animate__animated animate__zoomIn" style={{ maxWidth: '350px' }}>
            <div className="text-danger mb-3"><i className="fas fa-exclamation-circle fa-3x"></i></div>
            <h5 className="fw-bold">¿Eliminar registro?</h5>
            <p className="text-muted small">Vas a borrar la asistencia de <strong>{registroAEliminar.nombre}</strong>.</p>
            <div className="d-flex gap-2">
              <button className="btn btn-light w-100 fw-bold" onClick={() => setRegistroAEliminar(null)}>Cancelar</button>
              <button className="btn btn-danger w-100 fw-bold" onClick={ejecutarBorrado}>Sí, Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Historial;