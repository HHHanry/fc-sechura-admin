import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ModalDeudores = ({ isOpen, onClose, alumnos, deudasExtras }) => {
  const navigate = useNavigate();
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroDistrito, setFiltroDistrito] = useState('Todos');

  if (!isOpen) return null;

  // === LÓGICA CENTRAL DE MOROSIDAD ===
  const d = new Date();
  const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const PRECIO_MENSUALIDAD = 65; 

  const distritosExistentes = ['Todos', ...new Set(alumnos.map(a => a.distrito).filter(d => d))];

  const listaDeudores = alumnos.map(alumno => {
    const vencimiento = alumno.vencimientoMensualidad || '2000-01-01';
    const debeMes = hoyLocal >= vencimiento;
    
    const deudasDelAlumno = deudasExtras.filter(deuda => deuda.alumnoId === alumno.id);
    const totalExtras = deudasDelAlumno.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);

    if (!debeMes && totalExtras === 0) return null;

    let diasAtraso = 0;
    if (debeMes) {
      try {
        const vDate = new Date(vencimiento);
        if (!isNaN(vDate.getTime())) {
          const diffTime = Math.abs(new Date() - vDate);
          diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      } catch (e) { diasAtraso = 0; }
    }

    const montoTotalAdeudado = (debeMes ? PRECIO_MENSUALIDAD : 0) + totalExtras;

    return { ...alumno, debeMes, vencimiento, diasAtraso, deudasDelAlumno, totalExtras, montoTotalAdeudado };
  }).filter(Boolean); 

  // === APLICAR FILTROS ===
  const deudoresFiltrados = listaDeudores
    .filter(a => filtroCategoria === 'Todas' || a.categoria === filtroCategoria)
    .filter(a => filtroDistrito === 'Todos' || a.distrito === filtroDistrito)
    .sort((a, b) => b.montoTotalAdeudado - a.montoTotalAdeudado);

  const totalProyectado = deudoresFiltrados.reduce((sum, a) => sum + a.montoTotalAdeudado, 0);

  // === IMPRESIÓN DEL REPORTE ===
  const imprimirReporteMorosos = () => {
    const contenidoHTML = document.getElementById('area-impresion-morosos').innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html><head><title>Central de Morosidad</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: system-ui, sans-serif; padding: 20px; background: white; }
        .btn-no-print, select, .action-buttons { display: none !important; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; font-size: 11px; }
        th { background-color: #dc3545 !important; color: white !important; border: 1px solid #000; padding: 8px; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        td { border: 1px solid #dee2e6; padding: 8px; }
        .text-danger { color: #dc3545 !important; font-weight: bold; }
        .header { border-bottom: 3px solid #dc3545; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; }
      </style></head>
      <body>
        <div class="header">
          <div><h2 style="margin:0; color:#dc3545; font-weight:900;">FC SECHURA</h2><p style="margin:0; font-weight:bold;">REPORTE DE COBRANZAS (${filtroDistrito === 'Todos' ? 'GENERAL' : filtroDistrito.toUpperCase()})</p></div>
          <div style="text-align:right;"><p style="margin:0; font-size:12px;">Fecha: ${hoyLocal}</p><h4 style="margin:0;">Deuda Proyectada: S/ ${totalProyectado.toFixed(2)}</h4></div>
        </div>
        ${contenidoHTML}
      </body></html>
    `);
    doc.close(); iframe.contentWindow.focus();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  };

  return (
    <div className="modal-overlay d-flex align-items-center justify-content-center p-2 p-md-4" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      
      {/* CONTENEDOR PRINCIPAL DEL MODAL */}
      <div className="bg-white rounded-4 shadow-lg overflow-hidden d-flex flex-column animate__animated animate__zoomIn" style={{ width: '100%', maxWidth: '1100px', height: '95vh', maxHeight: '95vh' }} onClick={(e) => e.stopPropagation()}>
        
        {/* 1. HEADER FIJO */}
        <div className="bg-danger p-3 p-md-4 text-white d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center">
            <div className="bg-white text-danger rounded-circle d-flex align-items-center justify-content-center me-2 me-md-3 shadow-sm flex-shrink-0" style={{ width: '40px', height: '40px' }}>
              <i className="fas fa-hand-holding-usd fs-5"></i>
            </div>
            <div>
              <h5 className="fw-black mb-0 text-uppercase tracking-wider fs-6 fs-md-5">Riesgo & Cobranzas</h5>
              <p className="mb-0 small fw-medium opacity-75 d-none d-sm-block" style={{fontSize: '0.8rem'}}>Panel de auditoría de pagos atrasados.</p>
            </div>
          </div>
          <button className="btn btn-sm btn-outline-light border-0 rounded-circle" onClick={onClose}><i className="fas fa-times fs-5"></i></button>
        </div>

        {/* 2. CUERPO SCROLLABLE (Aquí metemos los filtros y la tabla para que fluyan juntos) */}
        <div className="bg-white" style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          
          {/* DASHBOARD Y FILTROS */}
          <div className="p-3 border-bottom bg-light">
            <div className="row g-2 g-md-3 align-items-center">
              
              {/* Tarjetas Resumen */}
              <div className="col-6 col-md-4">
                <div className="card border-danger border-opacity-25 shadow-sm h-100">
                  <div className="card-body p-2 p-md-3 d-flex justify-content-between align-items-center">
                    <div>
                      <span className="small fw-bold text-danger text-uppercase d-block" style={{fontSize:'0.65rem'}}>Déficit</span>
                      <h5 className="fw-black text-dark mb-0 fs-6 fs-md-4 text-nowrap">S/ {totalProyectado.toFixed(2)}</h5>
                    </div>
                    <i className="fas fa-chart-line fs-3 text-danger opacity-25 d-none d-sm-block"></i>
                  </div>
                </div>
              </div>
              
              <div className="col-6 col-md-3">
                <div className="card border-warning border-opacity-50 shadow-sm h-100">
                  <div className="card-body p-2 p-md-3 d-flex justify-content-between align-items-center">
                    <div>
                      <span className="small fw-bold text-warning text-dark text-uppercase d-block" style={{fontSize:'0.65rem'}}>Deudores</span>
                      <h5 className="fw-black text-dark mb-0 fs-6 fs-md-4">{deudoresFiltrados.length}</h5>
                    </div>
                    <i className="fas fa-users fs-3 text-warning opacity-50 d-none d-sm-block"></i>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="col-12 col-md-5 mt-2 mt-md-0">
                <div className="d-flex gap-2">
                  <select className="form-select form-select-sm border-2 shadow-sm fw-bold text-secondary" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                    <option value="Todas">Categorías</option>
                    {['6', '8', '10', '12', '13', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
                  </select>
                  
                  <select className="form-select form-select-sm border-2 shadow-sm fw-bold text-secondary" value={filtroDistrito} onChange={(e) => setFiltroDistrito(e.target.value)}>
                    {distritosExistentes.map(dist => (
                      <option key={dist} value={dist}>{dist === 'Todos' ? 'Distritos' : dist}</option>
                    ))}
                  </select>

                  <button className="btn btn-sm btn-danger fw-bold shadow-sm rounded-3 px-3 flex-shrink-0" title="Exportar a PDF" onClick={imprimirReporteMorosos}>
                    <i className="fas fa-print"></i>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* TABLA DE DEUDORES */}
          <div id="area-impresion-morosos" className="p-0">
            <div className="table-responsive w-100" style={{ overflowX: 'auto' }}>
              <table className="table table-hover align-middle mb-0" style={{ minWidth: '750px' }}>
                <thead className="bg-white" style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}>
                  <tr>
                    <th className="py-3 ps-3 ps-md-4 text-muted fw-bold text-uppercase border-bottom-0" style={{fontSize: '0.75rem'}}>Alumno / Datos</th>
                    <th className="py-3 text-muted fw-bold text-center text-uppercase border-bottom-0" style={{fontSize: '0.75rem'}}>Cat.</th>
                    <th className="py-3 text-muted fw-bold text-uppercase border-bottom-0" style={{fontSize: '0.75rem'}}>Conceptos Pendientes</th>
                    <th className="py-3 text-muted fw-bold text-end text-uppercase border-bottom-0" style={{fontSize: '0.75rem'}}>Deuda Est.</th>
                    <th className="py-3 pe-3 pe-md-4 text-muted fw-bold text-center text-uppercase border-bottom-0 action-buttons btn-no-print" style={{fontSize: '0.75rem'}}>Gestión</th>
                  </tr>
                </thead>
                <tbody>
                  {deudoresFiltrados.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-5 text-muted fw-bold"><i className="fas fa-medal fa-3x mb-3 text-success opacity-50"></i><br/>¡Excelente! No hay alumnos morosos.</td></tr>
                  ) : (
                    deudoresFiltrados.map((a) => {
                      const numLimpio = a.celular ? String(a.celular).replace(/\D/g, '') : '';
                      const msj = `Hola, te escribimos de *FC Sechura*. Queríamos recordarte que el alumno *${a.nombre} ${a.apellido}* presenta un saldo pendiente en el sistema por S/ ${a.montoTotalAdeudado.toFixed(2)}. Por favor, acércate a regularizarlo. ¡Gracias!`;
                      const linkWa = numLimpio.length >= 9 ? `https://wa.me/51${numLimpio}?text=${encodeURIComponent(msj)}` : null;

                      return (
                        <tr key={a.id}>
                          <td className="ps-3 ps-md-4">
                            <div className="fw-black text-dark text-truncate" style={{maxWidth: '180px'}}>{a.nombre} {a.apellido}</div>
                            <div className="small text-muted font-monospace mt-1 text-truncate" style={{maxWidth: '180px', fontSize: '0.75rem'}}>
                              <i className="fas fa-map-marker-alt text-danger me-1"></i>{a.distrito || 'N/R'} <br className="d-block d-md-none" />
                              <span className="d-none d-md-inline"> | </span>
                              <i className="fas fa-user-shield text-primary mx-1"></i>{a.apoderado || 'N/R'}
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="badge bg-light text-dark border border-secondary px-2 py-1 rounded-pill" style={{fontSize: '0.70rem'}}>C. {a.categoria}</span>
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1 my-2">
                              {a.debeMes && (
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger text-start px-2 py-1 text-wrap" style={{lineHeight: '1.2', width: 'fit-content'}}>
                                  <i className="fas fa-calendar-times me-1"></i> Mensualidad (Atraso: {a.diasAtraso}d)
                                </span>
                              )}
                              {a.deudasDelAlumno.map(d => (
                                <span key={d.id} className="badge bg-warning bg-opacity-10 text-dark border border-warning text-start px-2 py-1 text-wrap" style={{lineHeight: '1.2', width: 'fit-content'}}>
                                  <i className="fas fa-shopping-basket me-1 text-warning"></i> {d.concepto} (S/{d.monto})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-end fw-black text-danger fs-6 fs-md-5 text-nowrap">
                            S/ {a.montoTotalAdeudado.toFixed(2)}
                          </td>
                          <td className="pe-3 pe-md-4 text-center action-buttons btn-no-print">
                            <div className="d-flex justify-content-center gap-1 gap-md-2">
                              {linkWa ? (
                                <a href={linkWa} target="_blank" rel="noreferrer" className="btn btn-sm btn-success rounded-circle shadow-sm flex-shrink-0" style={{width:'32px', height:'32px'}} title="Notificar por WhatsApp">
                                  <i className="fab fa-whatsapp"></i>
                                </a>
                              ) : (
                                <button className="btn btn-sm btn-secondary rounded-circle shadow-sm opacity-50 flex-shrink-0" style={{width:'32px', height:'32px'}} disabled title="Sin número registrado">
                                  <i className="fab fa-whatsapp"></i>
                                </button>
                              )}
                              <button className="btn btn-sm btn-danger fw-bold rounded-pill shadow-sm px-2 px-md-3" onClick={() => { onClose(); navigate('registrar-pago'); }}>
                                Cobrar
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
        </div>

        {/* 3. FOOTER FIJO */}
        <div className="p-3 p-md-3 bg-light border-top text-center btn-no-print flex-shrink-0">
          <button className="btn btn-secondary fw-bold px-5 rounded-pill shadow-sm" onClick={onClose}>Cerrar Panel</button>
        </div>

      </div>
    </div>
  );
};

export default ModalDeudores;