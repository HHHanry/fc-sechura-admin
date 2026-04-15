import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ModalDeudores = ({ isOpen, onClose, alumnos, deudasExtras }) => {
  const navigate = useNavigate();
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');

  if (!isOpen) return null;

  // === LÓGICA CENTRAL DE MOROSIDAD ===
  const d = new Date();
  const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  const PRECIO_MENSUALIDAD = 60; // Monto estimado para proyectar la deuda total

  const listaDeudores = alumnos.map(alumno => {
    const vencimiento = alumno.vencimientoMensualidad || '2000-01-01';
    const debeMes = hoyLocal >= vencimiento;
    
    // Buscar si tiene deudas extras (uniformes, torneos, etc.)
    const deudasDelAlumno = deudasExtras.filter(deuda => deuda.alumnoId === alumno.id);
    const totalExtras = deudasDelAlumno.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);

    // Si no debe mes y no tiene deudas extras, no es deudor
    if (!debeMes && totalExtras === 0) return null;

    // Calcular días de atraso
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

    return {
      ...alumno,
      debeMes,
      vencimiento,
      diasAtraso,
      deudasDelAlumno,
      totalExtras,
      montoTotalAdeudado
    };
  }).filter(Boolean); // Eliminamos los nulos (los que están al día)

  // Filtrado por categoría
  const deudoresFiltrados = listaDeudores
    .filter(a => filtroCategoria === 'Todas' || a.categoria === filtroCategoria)
    .sort((a, b) => b.montoTotalAdeudado - a.montoTotalAdeudado); // Ordenar por los que deben más

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
          <div><h2 style="margin:0; color:#dc3545; font-weight:900;">FC SECHURA</h2><p style="margin:0; font-weight:bold;">REPORTE DE MOROSIDAD Y COBRANZAS</p></div>
          <div style="text-align:right;"><p style="margin:0; font-size:12px;">Fecha: ${hoyLocal}</p><h4 style="margin:0;">Deuda Proyectada: S/ ${totalProyectado.toFixed(2)}</h4></div>
        </div>
        ${contenidoHTML}
      </body></html>
    `);
    doc.close(); iframe.contentWindow.focus();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  };

  return (
    <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      
      <div className="bg-white rounded-4 shadow-lg overflow-hidden d-flex flex-column animate__animated animate__fadeInUp" style={{ width: '95%', maxWidth: '1000px', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER DEL MODAL */}
        <div className="bg-danger p-4 text-white d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <div className="bg-white text-danger rounded-circle d-flex align-items-center justify-content-center me-3 shadow" style={{ width: '50px', height: '50px' }}>
              <i className="fas fa-hand-holding-usd fs-4"></i>
            </div>
            <div>
              <h4 className="fw-black mb-0 text-uppercase tracking-wider">Central de Riesgo y Cobranzas</h4>
              <p className="mb-0 small fw-medium opacity-75">Panel de auditoría de pagos atrasados y deudas de tienda.</p>
            </div>
          </div>
          <button className="btn btn-outline-light border-0 rounded-circle" onClick={onClose}><i className="fas fa-times fs-4"></i></button>
        </div>

        {/* DASHBOARD Y FILTROS */}
        <div className="p-4 border-bottom bg-light">
          <div className="row g-3 align-items-center">
            <div className="col-md-4">
              <div className="card border-danger border-opacity-25 shadow-sm">
                <div className="card-body p-3 d-flex justify-content-between align-items-center">
                  <div>
                    <span className="small fw-bold text-danger text-uppercase">Déficit Estimado</span>
                    <h3 className="fw-black text-dark mb-0">S/ {totalProyectado.toFixed(2)}</h3>
                  </div>
                  <i className="fas fa-chart-line fa-2x text-danger opacity-25"></i>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-warning border-opacity-50 shadow-sm">
                <div className="card-body p-3 d-flex justify-content-between align-items-center">
                  <div>
                    <span className="small fw-bold text-warning text-dark text-uppercase">Total Deudores</span>
                    <h3 className="fw-black text-dark mb-0">{deudoresFiltrados.length} Alumnos</h3>
                  </div>
                  <i className="fas fa-users fa-2x text-warning opacity-50"></i>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-bold text-muted mb-1">Filtrar por Categoría</label>
              <div className="d-flex gap-2">
                <select className="form-select border-2 shadow-sm fw-bold text-secondary" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                  <option value="Todas">Todas las Categorías</option>
                  {['6', '8', '10', '12', '13', '15', 'Juvenil'].map(c => <option key={c} value={c}>Cat. {c}</option>)}
                </select>
                <button className="btn btn-danger fw-bold shadow-sm rounded-3" title="Exportar a PDF" onClick={imprimirReporteMorosos}>
                  <i className="fas fa-file-pdf"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TABLA DE DEUDORES */}
        <div className="p-0 overflow-auto bg-white" style={{ flexGrow: 1 }} id="area-impresion-morosos">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-white sticky-top" style={{ zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <tr>
                <th className="py-3 ps-4 text-muted small fw-bold text-uppercase border-bottom-0">Alumno / Apoderado</th>
                <th className="py-3 text-muted small fw-bold text-center text-uppercase border-bottom-0">Categoría</th>
                <th className="py-3 text-muted small fw-bold text-uppercase border-bottom-0">Conceptos Pendientes</th>
                <th className="py-3 text-muted small fw-bold text-end text-uppercase border-bottom-0">Deuda Est.</th>
                <th className="py-3 pe-4 text-muted small fw-bold text-center text-uppercase border-bottom-0 action-buttons btn-no-print">Gestión</th>
              </tr>
            </thead>
            <tbody>
              {deudoresFiltrados.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-5 text-muted fw-bold"><i className="fas fa-medal fa-3x mb-3 text-success opacity-50"></i><br/>¡Excelente! No hay alumnos morosos en esta categoría.</td></tr>
              ) : (
                deudoresFiltrados.map((a) => {
                  // Link de WhatsApp Inteligente
                  const numLimpio = a.celular ? String(a.celular).replace(/\D/g, '') : '';
                  const msj = `Hola, te escribimos de *FC Sechura*. Queríamos recordarte que el alumno *${a.nombre} ${a.apellido}* presenta un saldo pendiente en el sistema por S/ ${a.montoTotalAdeudado.toFixed(2)}. Por favor, acércate a regularizarlo. ¡Gracias!`;
                  const linkWa = numLimpio.length >= 9 ? `https://wa.me/51${numLimpio}?text=${encodeURIComponent(msj)}` : null;

                  return (
                    <tr key={a.id}>
                      <td className="ps-4">
                        <div className="fw-black text-dark">{a.nombre} {a.apellido}</div>
                        <div className="small text-muted font-monospace mt-1"><i className="fas fa-user-shield me-1"></i>{a.apoderado || 'Sin apoderado'} {a.celular ? `(${a.celular})` : ''}</div>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-light text-dark border border-secondary px-3 py-1 rounded-pill">Cat. {a.categoria}</span>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          {a.debeMes && (
                            <span className="badge bg-danger bg-opacity-10 text-danger border border-danger text-start px-2 py-1 w-auto" style={{maxWidth:'max-content'}}>
                              <i className="fas fa-calendar-times me-1"></i> Mensualidad (Atraso: {a.diasAtraso} días)
                            </span>
                          )}
                          {a.deudasDelAlumno.map(d => (
                            <span key={d.id} className="badge bg-warning bg-opacity-10 text-dark border border-warning text-start px-2 py-1 w-auto" style={{maxWidth:'max-content'}}>
                              <i className="fas fa-shopping-basket me-1 text-warning"></i> {d.concepto} (S/ {d.monto})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-end fw-black text-danger fs-5">
                        S/ {a.montoTotalAdeudado.toFixed(2)}
                      </td>
                      <td className="pe-4 text-center action-buttons btn-no-print">
                        <div className="d-flex justify-content-center gap-2">
                          {linkWa ? (
                            <a href={linkWa} target="_blank" rel="noreferrer" className="btn btn-sm btn-success rounded-circle shadow-sm" title="Notificar por WhatsApp">
                              <i className="fab fa-whatsapp"></i>
                            </a>
                          ) : (
                            <button className="btn btn-sm btn-secondary rounded-circle shadow-sm opacity-50" disabled title="Sin número registrado">
                              <i className="fab fa-whatsapp"></i>
                            </button>
                          )}
                          <button className="btn btn-sm btn-danger fw-bold rounded-pill shadow-sm px-3" onClick={() => { onClose(); navigate('registrar-pago'); }}>
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

        {/* FOOTER DEL MODAL */}
        <div className="p-3 bg-light border-top text-center btn-no-print">
          <button className="btn btn-secondary fw-bold px-5 rounded-pill shadow-sm" onClick={onClose}>Cerrar Panel</button>
        </div>

      </div>
    </div>
  );
};

export default ModalDeudores;