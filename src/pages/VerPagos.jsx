import React, { useState, useEffect } from 'react';
import logo from '../assets/logonegro.png'; 

// === IMPORTACIONES DE FIREBASE ===
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, orderBy, query, where, getDoc } from 'firebase/firestore';
import ModalDeudores from '../components/ModalDeudores';

const VerPagos = () => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMes, setFiltroMes] = useState('Todos'); // Cambiado a 'Todos' por defecto
  const [filtroMetodo, setFiltroMetodo] = useState('Todos');
  const [filtroEstado, setFiltroEstado] = useState('Completado');
  const [ordenarPor, setOrdenarPor] = useState('fecha_desc');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroAlumnoId, setFiltroAlumnoId] = useState('Todos');
  
  const [reciboSeleccionado, setReciboSeleccionado] = useState(null); 
  const [reciboAAnular, setReciboAAnular] = useState(null); 
  const [modalDeudoresAbierto, setModalDeudoresAbierto] = useState(false);
  
  // === ESTADOS PARA FIREBASE ===
  const [pagos, setPagos] = useState([]);
  const [alumnosBD, setAlumnosBD] = useState([]); 
  const [deudasBD, setDeudasBD] = useState([]); 
  const [cargando, setCargando] = useState(true);
  const [anulando, setAnulando] = useState(false);

  const mesesOptions = [
    { value: 'Todos', label: 'Todo el Historial' },
    { value: '01-2026', label: 'Enero 2026' }, { value: '02-2026', label: 'Febrero 2026' },
    { value: '03-2026', label: 'Marzo 2026' }, { value: '04-2026', label: 'Abril 2026' },
    { value: '05-2026', label: 'Mayo 2026' }, { value: '06-2026', label: 'Junio 2026' }
  ];

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const alumnosSnap = await getDocs(collection(db, 'alumnos'));
        const listaAlumnos = alumnosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        listaAlumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setAlumnosBD(listaAlumnos);

        const deudasQ = query(collection(db, 'deudas'), where('estado', '==', 'Pendiente'));
        const deudasSnap = await getDocs(deudasQ);
        setDeudasBD(deudasSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const q = query(collection(db, 'pagos'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const listaPagos = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            firebaseId: doc.id, id: data.idRecibo || 'REC-XXXXXX', alumnoId: data.alumnoId || '', 
            alumno: data.alumnoNombre || 'Desconocido', dni: data.alumnoDni || '', 
            monto: data.total || 0, concepto: data.conceptoResumen || '', 
            fecha: data.fecha || '', metodo: data.metodo || 'Efectivo', estado: data.estado || 'Completado',
            items: data.items || [] // Guardamos los items para la lógica de anulación
          };
        });
        setPagos(listaPagos);
      } catch (error) { console.error(error); } finally { setCargando(false); }
    };
    cargarDatos();
  }, []);

  const opcionesAlumnos = alumnosBD.filter(a => filtroCategoria === 'Todas' ? true : a.categoria === filtroCategoria);
  useEffect(() => { setFiltroAlumnoId('Todos'); }, [filtroCategoria]);

  const pagosProcesados = pagos
    .filter(p => {
      const matchBusqueda = p.alumno.toLowerCase().includes(busqueda.toLowerCase()) || p.dni.includes(busqueda) || p.id.toLowerCase().includes(busqueda.toLowerCase());
      const matchMes = filtroMes === 'Todos' ? true : p.fecha.startsWith(`${filtroMes.split('-')[1]}-${filtroMes.split('-')[0]}`); 
      const matchMetodo = filtroMetodo === 'Todos' || p.metodo === filtroMetodo;
      const matchEstado = filtroEstado === 'Todos' || p.estado === filtroEstado;
      const infoAlumno = alumnosBD.find(a => a.id === p.alumnoId);
      const catAlumno = infoAlumno ? infoAlumno.categoria : 'Desconocida';
      const matchCategoria = filtroCategoria === 'Todas' || catAlumno === filtroCategoria;
      const matchAlumnoSelect = filtroAlumnoId === 'Todos' || p.alumnoId === filtroAlumnoId;

      return matchBusqueda && matchMes && matchMetodo && matchEstado && matchCategoria && matchAlumnoSelect;
    })
    .sort((a, b) => {
      if (ordenarPor === 'fecha_desc') return new Date(b.fecha) - new Date(a.fecha);
      if (ordenarPor === 'fecha_asc') return new Date(a.fecha) - new Date(b.fecha);
      if (ordenarPor === 'monto_desc') return b.monto - a.monto;
      if (ordenarPor === 'monto_asc') return a.monto - b.monto;
      return 0;
    });

  const pagosCompletados = pagosProcesados.filter(p => p.estado === 'Completado');
  const totalRecaudado = pagosCompletados.reduce((sum, p) => sum + p.monto, 0);
  const totalEfectivo = pagosCompletados.filter(p => p.metodo === 'Efectivo').reduce((sum, p) => sum + p.monto, 0);
  const totalYape = pagosCompletados.filter(p => p.metodo.includes('Yape')).reduce((sum, p) => sum + p.monto, 0);
  const totalBancos = pagosCompletados.filter(p => p.metodo.includes('Transferencia')).reduce((sum, p) => sum + p.monto, 0);

  const d = new Date();
  const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const deudoresTotales = alumnosBD.filter(a => {
    const vencimiento = a.vencimientoMensualidad || '2000-01-01';
    const debeMes = hoyLocal >= vencimiento; 
    const debeAlgoExtra = deudasBD.some(deuda => deuda.alumnoId === a.id);
    return debeMes || debeAlgoExtra;
  });

  const pendientesConteo = deudoresTotales.length;

  // === MAGIA: LÓGICA DE ANULACIÓN PROFESIONAL ===
  const ejecutarAnulacion = async () => {
    setAnulando(true);
    try {
      // 1. Marcar el recibo como anulado
      const pagoRef = doc(db, 'pagos', reciboAAnular.firebaseId);
      await updateDoc(pagoRef, { estado: 'Anulado' });

      // 2. Analizar qué se pagó en ese recibo para revertirlo
      const itemsPagados = reciboAAnular.items || [];
      let revirtioMensualidad = false;

      for (let item of itemsPagados) {
        // A. Si pagó una Deuda Vieja, la revivimos (Estado -> Pendiente)
        if (item.isDeudaVieja && item.deudaId) {
          await updateDoc(doc(db, 'deudas', item.deudaId), { estado: 'Pendiente', fechaPago: null });
        }
        // B. Si pagó una Mensualidad, tenemos que restarle un mes al alumno
        if (item.concepto.includes('Mensualidad')) {
          revirtioMensualidad = true;
        }
      }

      if (revirtioMensualidad) {
        const alumnoRef = doc(db, 'alumnos', reciboAAnular.alumnoId);
        const alumnoDoc = await getDoc(alumnoRef);
        if (alumnoDoc.exists()) {
          const datosAlum = alumnoDoc.data();
          const vActual = new Date(datosAlum.vencimientoMensualidad || reciboAAnular.fecha);
          // Le restamos el mes que había adelantado
          vActual.setMonth(vActual.getMonth() - 1); 
          await updateDoc(alumnoRef, { vencimientoMensualidad: vActual.toISOString().split('T')[0] });
        }
      }

      setPagos(pagos.map(p => p.id === reciboAAnular.id ? { ...p, estado: 'Anulado' } : p));
      alert("Recibo anulado con éxito. Los saldos del alumno han sido revertidos.");
      setReciboAAnular(null); 
    } catch (error) { 
      console.error(error); 
      alert("Hubo un error al anular. Revisa tu conexión.");
    } finally { 
      setAnulando(false); 
    }
  };

  const exportarExcel = () => {
    const titulo = `Auditoría de Caja - FC Sechura - ${filtroMes}`;
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>table { border-collapse: collapse; width: 100%; } th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #000000; text-align: center; vertical-align: middle; height: 30px; } td { border: 1px solid #000000; text-align: center; vertical-align: middle; height: 25px; } .monto { mso-number-format:"\\S\\/\\ #,##0.00"; }</style></head><body><h2>${titulo}</h2><table><thead><tr><th>RECIBO</th><th>FECHA</th><th>ALUMNO</th><th>DNI</th><th>CONCEPTO</th><th>METODO</th><th>MONTO</th><th>ESTADO</th></tr></thead><tbody>`;
    pagosProcesados.forEach(p => {
      html += `<tr><td>${p.id}</td><td>${p.fecha}</td><td>${p.alumno}</td><td>${p.dni}</td><td>${p.concepto}</td><td>${p.metodo}</td><td class="monto">${p.monto.toFixed(2)}</td><td style="color: ${p.estado === 'Completado' ? '#157347' : '#dc3545'}">${p.estado}</td></tr>`;
    });
    html += `<tr><td colspan="6" style="text-align:right; font-weight:bold;">TOTAL RECAUDADO (Completados):</td><td class="monto" style="font-weight:bold; color:#1e3a8a;">${totalRecaudado.toFixed(2)}</td><td></td></tr>`;
    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.setAttribute("download", `Reporte_Caja_${filtroMes}.xls`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const imprimirAislado = (elementoId, esHorizontal) => {
    const contenidoHTML = document.getElementById(elementoId).innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html><head><title>Comprobante FC Sechura</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>@page { size: ${esHorizontal ? 'A4 landscape' : 'A4 portrait'}; margin: 15mm; } body { background: white !important; font-family: system-ui, sans-serif; padding: 20px; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .btn-no-print { display: none !important; } .table { border-collapse: collapse; width: 100%; margin-top: 20px; } .table th { border-bottom: 2px solid black; padding: 10px; } .table td { border-bottom: 1px solid #dee2e6; padding: 10px; } .text-azul { color: #1e3a8a !important; }</style></head><body>${contenidoHTML}</body></html>
    `);
    doc.close(); iframe.contentWindow.focus();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => { document.body.removeChild(iframe); }, 1000); }, 800);
  };

  const imprimirTablaPagos = () => {
    const ventanaImpresion = window.open('', '_blank');
    let html = `
      <html>
      <head>
        <title>Reporte de Pagos - FC Sechura</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px; }
          .title-section h1 { color: #1e3a8a; margin: 0; font-size: 24px; }
          .title-section p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
          .resumen { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
          .resumen-box { padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background-color: #1e3a8a; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .text-success { color: #10b981; font-weight: bold; }
          .text-danger { color: #ef4444; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-section">
            <h1>Auditoría de Caja y Pagos</h1>
            <p>Filtro aplicado: ${filtroMes} | Categoría: ${filtroCategoria} | Estado: ${filtroEstado}</p>
          </div>
          <div><h2 style="margin:0; color:#1e3a8a;">S/ ${totalRecaudado.toFixed(2)}</h2><p style="margin:0; font-size:12px; color:#64748b; text-align:right;">Recaudación Líquida</p></div>
        </div>

        <div class="resumen">
          <div class="resumen-box"><strong>💵 Efectivo:</strong> S/ ${totalEfectivo.toFixed(2)}</div>
          <div class="resumen-box"><strong>📱 Yape/Plin:</strong> S/ ${totalYape.toFixed(2)}</div>
          <div class="resumen-box"><strong>🏦 Bancos:</strong> S/ ${totalBancos.toFixed(2)}</div>
        </div>

        <table>
          <thead>
            <tr><th>Recibo</th><th>Fecha</th><th>Alumno</th><th>DNI</th><th>Concepto</th><th>Método</th><th class="text-right">Monto</th><th class="text-center">Estado</th></tr>
          </thead>
          <tbody>
    `;

    pagosProcesados.forEach(p => {
      const colorEstado = p.estado === 'Completado' ? 'text-success' : (p.estado === 'Anulado' ? 'text-danger' : '');
      const estiloFila = p.estado === 'Anulado' ? 'style="text-decoration: line-through; opacity: 0.6;"' : '';
      
      html += `<tr ${estiloFila}>
        <td><strong>${p.id}</strong></td>
        <td>${p.fecha}</td>
        <td>${p.alumno}</td>
        <td>${p.dni}</td>
        <td>${p.concepto}</td>
        <td>${p.metodo}</td>
        <td class="text-right"><strong>S/ ${p.monto.toFixed(2)}</strong></td>
        <td class="text-center ${colorEstado}">${p.estado}</td>
      </tr>`;
    });

    html += `</tbody></table>
      <script>window.onload = () => { window.print(); window.close(); };</script>
      </body></html>`;

    ventanaImpresion.document.write(html);
    ventanaImpresion.document.close();
  };

  return (
    <div className="container py-4 mb-5">
      
      <div>
        <div className="row mb-4 align-items-center">
          <div className="col-md-8">
            <h1 className="fw-bold" style={{ color: 'var(--fc-azul)' }}>Auditoría y Recaudación</h1>
            <p className="text-muted">Control de ingresos, métodos de pago y gestión de recibos emitidos.</p>
          </div>
          <div className="col-md-4 text-md-end btn-no-print d-flex gap-2 justify-content-md-end">
            <button className="btn btn-outline-success fw-bold rounded-pill px-3 shadow-sm border-2" onClick={exportarExcel}>
              <i className="fas fa-file-excel me-2"></i> Excel
            </button>
            <button className="btn btn-turquesa text-white fw-bold rounded-pill px-4 shadow-sm" onClick={imprimirTablaPagos}>
              <i className="fas fa-file-pdf me-2"></i> Auditoría PDF
            </button>
          </div>
        </div>

        {/* DASHBOARD FINANCIERO SUPERIOR */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-primary">
              <span className="text-muted small fw-bold text-uppercase d-flex justify-content-between">Ingreso Bruto <i className="fas fa-chart-line text-primary btn-no-print"></i></span>
              <h2 className="fw-black text-azul mt-2 mb-0">S/ {totalRecaudado.toFixed(2)}</h2>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-success">
              <span className="text-muted small fw-bold text-uppercase d-flex justify-content-between">Efectivo Físico <i className="fas fa-money-bill-wave text-success btn-no-print"></i></span>
              <h2 className="fw-black text-success mt-2 mb-0">S/ {totalEfectivo.toFixed(2)}</h2>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 border-start border-4 border-info">
              <span className="text-muted small fw-bold text-uppercase d-flex justify-content-between">Bancos / Digital <i className="fas fa-mobile-alt text-info btn-no-print"></i></span>
              <h2 className="fw-black text-info mt-2 mb-0">S/ {(totalYape + totalBancos).toFixed(2)}</h2>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-lg rounded-4 p-3 bg-white h-100 border-start border-4 border-danger cursor-pointer btn-no-print" style={{ cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'} onClick={() => setModalDeudoresAbierto(true)} >
              <span className="text-danger small fw-bold text-uppercase d-flex justify-content-between">
                Alerta de Morosidad <i className="fas fa-exclamation-circle text-danger btn-no-print animate__animated animate__pulse animate__infinite"></i>
              </span>
              <h2 className="fw-black text-dark mt-2 mb-0">{pendientesConteo} <span className="fs-6 text-muted">Alumnos</span></h2>
              <div className="mt-2 text-end"><span className="badge bg-danger rounded-pill shadow-sm">Ver Deudores <i className="fas fa-arrow-right ms-1"></i></span></div>
            </div>
          </div>
        </div>

        {/* CONTROLES DE FILTRO */}
        <div className="card border-0 shadow-sm mb-4 bg-white rounded-4 p-3 btn-no-print">
          <div className="row g-3 align-items-end mb-3">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-muted mb-1">Búsqueda Rápida</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-0"><i className="fas fa-search"></i></span>
                <input type="text" className="form-control bg-light border-0" placeholder="Nombre, DNI o Recibo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold text-muted mb-1">Periodo (Mes)</label>
              <select className="form-select bg-light border-0 fw-bold text-primary" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
                {mesesOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-bold text-muted mb-1">Categoría</label>
              <select className="form-select bg-light border-0" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                <option value="Todas">Todas las Categorías</option>
                {['6', '8', '10', '12', '13', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted mb-1">Filtrar por Alumno</label>
              <select className="form-select bg-light border-0 fw-medium text-azul" value={filtroAlumnoId} onChange={(e) => setFiltroAlumnoId(e.target.value)}>
                <option value="Todos">Todos los alumnos</option>
                {opcionesAlumnos.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
              </select>
            </div>
          </div>

          <div className="row g-3 align-items-end border-top pt-2">
            <div className="col-6 col-md-3">
              <label className="form-label small fw-bold text-muted mb-1">Método de Pago</label>
              <select className="form-select bg-light border-0" value={filtroMetodo} onChange={(e) => setFiltroMetodo(e.target.value)}>
                <option value="Todos">Todos los métodos</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Yape/Plin">Yape/Plin</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-bold text-muted mb-1">Estado de Pago</label>
              <select className="form-select bg-light border-0" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="Todos">Todos los estados</option>
                <option value="Completado">Completados</option>
                <option value="Anulado">Anulados</option>
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small fw-bold text-muted mb-1">Criterio de Orden</label>
              <select className="form-select bg-light border-0 fw-bold" value={ordenarPor} onChange={(e) => setOrdenarPor(e.target.value)}>
                <option value="fecha_desc">Más recientes primero</option>
                <option value="fecha_asc">Más antiguos primero</option>
                <option value="monto_desc">Monto (Mayor a Menor)</option>
                <option value="monto_asc">Monto (Menor a Mayor)</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL DE RECIBOS */}
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light" style={{ borderBottom: '2px solid var(--fc-celeste)' }}>
                <tr>
                  <th className="ps-4 py-3 text-muted small fw-bold text-uppercase">Recibo / Fecha</th>
                  <th className="py-3 text-muted small fw-bold text-uppercase">Datos del Alumno</th>
                  <th className="py-3 text-muted small fw-bold text-uppercase">Concepto Facturado</th>
                  <th className="py-3 text-muted small fw-bold text-center text-uppercase">Vía</th>
                  <th className="py-3 text-muted small fw-bold text-end text-uppercase">Monto (S/)</th>
                  <th className="py-3 text-muted small fw-bold text-center text-uppercase">Status</th>
                  <th className="pe-4 py-3 text-muted small fw-bold text-end text-uppercase btn-no-print">Auditoría</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></td></tr>
                ) : pagosProcesados.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-5 text-muted fw-bold"><i className="fas fa-file-invoice fa-2x mb-2 opacity-50 d-block"></i> No se encontraron comprobantes.</td></tr>
                ) : (
                  pagosProcesados.map(p => (
                    <tr key={p.id} className={p.estado === 'Anulado' ? 'bg-light bg-opacity-50 text-decoration-line-through' : ''}>
                      <td className="ps-4">
                        <div className={`fw-bold ${p.estado === 'Anulado' ? 'text-muted' : 'text-azul'}`}>{p.id}</div>
                        <div className="small text-muted font-monospace"><i className="far fa-calendar-alt me-1"></i>{p.fecha}</div>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{p.alumno}</div>
                        <div className="small text-muted font-monospace">DNI: {p.dni}</div>
                      </td>
                      <td>
                        <div className="text-truncate fw-medium" style={{ maxWidth: '200px' }} title={p.concepto}>
                          {p.concepto}
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={`small fw-bold px-2 py-1 rounded ${p.metodo === 'Efectivo' ? 'bg-success bg-opacity-10 text-success' : 'bg-info bg-opacity-10 text-info'}`}>
                          {p.metodo === 'Efectivo' ? <i className="fas fa-money-bill-wave me-1"></i> : <i className="fas fa-mobile-alt me-1"></i>} {p.metodo}
                        </span>
                      </td>
                      <td className="text-end fw-black fs-6" style={{ color: p.estado === 'Anulado' ? '#94a3b8' : 'var(--fc-azul)' }}>{p.monto.toFixed(2)}</td>
                      <td className="text-center">
                        <span className={`badge rounded-pill px-3 py-2 w-100 ${p.estado === 'Completado' ? 'bg-success shadow-sm' : 'bg-danger shadow-sm'}`}>
                          {p.estado}
                        </span>
                      </td>
                      <td className="pe-4 text-end btn-no-print">
                        <div className="d-flex justify-content-end gap-2">
                          <button className="btn btn-sm btn-light border shadow-sm text-primary" title="Ver Boleta Física" onClick={() => setReciboSeleccionado(p)}>
                            <i className="fas fa-eye"></i>
                          </button>
                          {p.estado !== 'Anulado' && (
                            <button className="btn btn-sm btn-light border shadow-sm text-danger" title="Revertir Pago / Anular" onClick={() => setReciboAAnular(p)}>
                              <i className="fas fa-ban"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div> 

      {/* COMPONENTE MODAL DE DEUDORES CON DATOS CRUZADOS */}
      <ModalDeudores 
        isOpen={modalDeudoresAbierto} 
        onClose={() => setModalDeudoresAbierto(false)} 
        alumnos={alumnosBD} 
        deudasExtras={deudasBD} 
      />

      {/* MODAL DE ANULACIÓN INTELIGENTE */}
      {reciboAAnular && (
        <div className="modal-overlay d-flex align-items-center justify-content-center btn-no-print" style={{ zIndex: 2000 }} onClick={() => !anulando && setReciboAAnular(null)}>
          <div className="bg-white p-4 p-md-5 rounded-4 shadow-lg text-center mx-3 animate__animated animate__zoomIn" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-danger bg-opacity-10 text-danger rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '80px', height: '80px' }}>
              <i className="fas fa-file-excel fa-3x"></i>
            </div>
            <h3 className="fw-black text-dark mb-2">¿Anular Recibo?</h3>
            <p className="text-muted mb-3 fs-6">
              Estás a punto de cancelar el recibo <strong className="text-danger">{reciboAAnular.id}</strong> por <strong className="text-dark">S/ {reciboAAnular.monto.toFixed(2)}</strong>.
            </p>
            
            <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 p-3 mb-4 text-start">
              <h6 className="fw-bold text-danger mb-1"><i className="fas fa-info-circle me-1"></i> Efecto Dominó de la Auditoría:</h6>
              <ul className="small text-danger mb-0 ps-3">
                <li>El dinero se restará de la recaudación de caja.</li>
                <li>Si el recibo incluía "Mensualidad", el alumno perderá su mes pagado y <strong>volverá a ser Moroso</strong>.</li>
                <li>Si era cobro de una deuda, la deuda volverá a su perfil.</li>
              </ul>
            </div>

            <div className="d-flex gap-3 justify-content-center">
              <button className="btn btn-light fw-bold px-4 py-2 border shadow-sm w-50" onClick={() => setReciboAAnular(null)} disabled={anulando}>Conservar</button>
              <button className="btn btn-danger fw-bold px-4 py-2 shadow-sm w-50 d-flex justify-content-center align-items-center" onClick={ejecutarAnulacion} disabled={anulando}>
                {anulando ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="fas fa-ban me-2"></i>}
                Anular Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LA BOLETA FÍSICA (PARA IMPRIMIR) */}
      {reciboSeleccionado && (
        <div className="modal-overlay d-flex flex-column align-items-center justify-content-center py-4" style={{ zIndex: 1500, overflowY: 'auto' }} onClick={() => setReciboSeleccionado(null)}>
          
          <div id="area-boleta-pdf" className="bg-white p-4 p-md-5 shadow-lg position-relative" 
               style={{ width: '100%', maxWidth: '450px', borderTop: '10px solid #1e3a8a', borderRadius: '12px' }}
               onClick={(e) => e.stopPropagation()} 
          >
            
            {/* MARCA DE AGUA GIGANTE SI ESTÁ ANULADO */}
            {reciboSeleccionado.estado === 'Anulado' && (
              <div className="position-absolute top-50 start-50 translate-middle text-danger opacity-25 fw-black" style={{ fontSize: '4rem', transform: 'translate(-50%, -50%) rotate(-30deg)', pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap' }}>
                A N U L A D O
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #ccc' }}>
              <div className="d-flex align-items-center">
                <img src={logo} alt="FC Sechura" style={{ width: '50px', height: '50px', objectFit: 'contain', marginRight: '10px' }} />
                <div>
                  <h4 className="fw-black text-dark mb-0 tracking-tight" style={{ color: '#1e3a8a', fontWeight: '900', fontSize: '18px' }}>FC SECHURA</h4>
                  <p className="text-muted mb-0 fw-bold" style={{ fontSize: '10px' }}>Academia de Fútbol Formativo</p>
                </div>
              </div>
              <div className="text-end">
                <h6 className="text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '9px' }}>Comprobante de Caja</h6>
                <h4 className="fw-bold mb-0 text-dark" style={{ fontSize: '14px' }}>{reciboSeleccionado.id}</h4>
              </div>
            </div>

            <div className="row mb-4 g-3" style={{ display: 'flex', flexWrap: 'wrap' }}>
              <div className="col-12" style={{ width: '100%', marginBottom: '10px' }}>
                <p className="text-muted fw-bold mb-1" style={{ fontSize: '8px' }}>CLIENTE / ALUMNO</p>
                <h6 className="fw-bold mb-0 text-uppercase" style={{ fontSize: '12px' }}>{reciboSeleccionado.alumno}</h6>
                <p className="text-muted mb-0 font-monospace" style={{ fontSize: '10px' }}>DNI: {reciboSeleccionado.dni || 'Sin Documento'}</p>
              </div>
              <div className="col-6" style={{ width: '50%' }}>
                <p className="text-muted fw-bold mb-1" style={{ fontSize: '8px' }}>FECHA DE OPERACIÓN</p>
                <h6 className="fw-bold mb-0 font-monospace" style={{ fontSize: '11px' }}>{reciboSeleccionado.fecha}</h6>
              </div>
              <div className="col-6 text-end" style={{ width: '50%', textAlign: 'right' }}>
                <p className="text-muted fw-bold mb-1" style={{ fontSize: '8px' }}>MÉTODO DE PAGO</p>
                <h6 className="fw-bold mb-0 text-uppercase" style={{ fontSize: '11px' }}>{reciboSeleccionado.metodo}</h6>
              </div>
            </div>

            <div className="bg-light rounded-3 p-3 mb-4" style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div className="d-flex justify-content-between pb-2 mb-2" style={{ borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                <span className="fw-bold text-secondary" style={{ fontSize: '9px' }}>DESCRIPCIÓN DEL SERVICIO</span>
                <span className="fw-bold text-secondary" style={{ fontSize: '9px' }}>IMPORTE</span>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="fw-bold text-dark text-uppercase" style={{ fontSize: '11px', width: '70%' }}>{reciboSeleccionado.concepto}</span>
                <span className="fw-bold text-dark font-monospace" style={{ fontSize: '12px' }}>S/ {reciboSeleccionado.monto.toFixed(2)}</span>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-end mb-4" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
              <span className="fw-bold text-muted text-uppercase" style={{ fontSize: '12px' }}>TOTAL PAGADO:</span>
              <span className="fw-black" style={{ color: '#1e3a8a', fontSize: '24px', fontWeight: '900' }}>S/ {reciboSeleccionado.monto.toFixed(2)}</span>
            </div>

            <div className="text-center pt-3 mt-4" style={{ borderTop: '1px dashed #ccc', textAlign: 'center' }}>
              <p className="text-dark fw-bold mb-1" style={{ fontSize: '10px' }}>"Formando talentos para el futuro"</p>
              <p className="text-muted mb-0" style={{ fontSize: '8px' }}>Comprobante de uso interno. Válido sin firma ni sello.</p>
            </div>
          </div>

          <div className="d-flex gap-3 mt-4 btn-no-print w-100 justify-content-center" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-light px-5 fw-bold shadow-sm border rounded-pill" onClick={() => setReciboSeleccionado(null)}>
              Cerrar
            </button>
            <button className="btn btn-primary text-white px-5 fw-bold shadow-lg rounded-pill" onClick={() => imprimirAislado('area-boleta-pdf', false)} disabled={reciboSeleccionado.estado === 'Anulado'}>
              <i className="fas fa-print me-2"></i> Imprimir Recibo
            </button>
          </div>

        </div>
      )}

    </div>
  );
};

export default VerPagos;