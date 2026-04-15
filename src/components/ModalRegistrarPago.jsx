import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const ModalRegistrarPago = ({ isOpen, onClose, alumno }) => {
  const MENSUALIDAD_BASE = 60.00;
  
  const [montoPagado, setMontoPagado] = useState(MENSUALIDAD_BASE);
  const [cargando, setCargando] = useState(false);

  if (!isOpen || !alumno) return null;

  const deudaRestante = MENSUALIDAD_BASE - montoPagado;

  const procesarCobro = async (e) => {
    e.preventDefault();
    setCargando(true);

    try {
      // 1. Calculamos la fecha base
      const d = new Date();
      const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      // Si es alumno antiguo sin fecha, calculamos su nuevo mes a partir de hoy
      let baseCalculo = alumno.vencimientoMensualidad || hoyLocal;
      let nuevoVencimiento = baseCalculo;
      
      // Si pagó completo, le sumamos 1 mes a su fecha base
      if (deudaRestante <= 0) {
        const partes = baseCalculo.split('-');
        const fechaActual = new Date(partes[0], partes[1] - 1, partes[2]);
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        
        const year = fechaActual.getFullYear();
        const month = String(fechaActual.getMonth() + 1).padStart(2, '0');
        const day = String(fechaActual.getDate()).padStart(2, '0');
        nuevoVencimiento = `${year}-${month}-${day}`;
      }

      // 2. Guardamos recibo histórico
      await addDoc(collection(db, 'historial_pagos'), {
        alumnoId: alumno.id,
        nombre: `${alumno.nombre} ${alumno.apellido}`,
        dni: alumno.dni,
        montoRecibido: Number(montoPagado),
        deudaGenerada: deudaRestante > 0 ? deudaRestante : 0,
        tipo: 'Mensualidad',
        fechaPago: hoyLocal,
        timestamp: serverTimestamp()
      });

      // 3. Actualizamos perfil
      const alumnoRef = doc(db, 'alumnos', alumno.id);
      await updateDoc(alumnoRef, {
        vencimientoMensualidad: nuevoVencimiento,
        deudaAcumulada: (alumno.deudaAcumulada || 0) + (deudaRestante > 0 ? deudaRestante : 0)
      });

      alert(`Pago registrado. ${deudaRestante > 0 ? `Queda debiendo S/ ${deudaRestante}` : 'Mes cubierto al 100%'}`);
      onClose();
      window.location.reload(); 

    } catch (error) {
      console.error("Error al cobrar:", error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="modal-overlay d-flex align-items-center justify-content-center" style={{ zIndex: 3000, background: 'rgba(0,0,0,0.6)', position: 'fixed', top:0, left:0, width:'100%', height:'100%' }}>
      <div className="bg-white p-4 rounded-4 shadow-lg w-100 mx-3" style={{ maxWidth: '400px' }}>
        
        <h5 className="fw-bold text-success mb-3"><i className="fas fa-money-bill-wave me-2"></i> Registrar Pago</h5>
        <div className="bg-light p-3 rounded-3 mb-4 border">
          <p className="mb-1 small text-muted">Cobrando a:</p>
          <h6 className="fw-bold mb-0">{alumno.nombre} {alumno.apellido}</h6>
          <p className="small text-danger mb-0 mt-2 fw-bold">Vencimiento actual: {alumno.vencimientoMensualidad || 'Sin registro previo'}</p>
        </div>

        <form onSubmit={procesarCobro}>
          <div className="mb-3">
            <label className="form-label fw-bold small text-muted">¿Cuánto está pagando hoy? (S/)</label>
            <div className="input-group input-group-lg">
              <span className="input-group-text bg-white">S/</span>
              <input 
                type="number" 
                className="form-control fw-bold text-success" 
                value={montoPagado} 
                onChange={(e) => setMontoPagado(e.target.value)}
                min="1"
                required
              />
            </div>
          </div>

          {deudaRestante > 0 && (
            <div className="alert alert-warning py-2 mb-4">
              <i className="fas fa-exclamation-triangle me-2"></i>
              <strong>Pago Parcial:</strong> Quedará debiendo <strong>S/ {deudaRestante.toFixed(2)}</strong>. Su fecha de vencimiento NO avanzará hasta cancelar la totalidad.
            </div>
          )}

          {deudaRestante <= 0 && (
            <div className="alert alert-success py-2 mb-4">
              <i className="fas fa-check-circle me-2"></i>
              <strong>Pago Completo:</strong> Su vencimiento se extenderá automáticamente 1 mes más.
            </div>
          )}

          <div className="d-flex gap-2 justify-content-end mt-4">
            <button type="button" className="btn btn-light border px-4 fw-bold" onClick={onClose} disabled={cargando}>Cancelar</button>
            <button type="submit" className="btn btn-success px-4 fw-bold shadow-sm" disabled={cargando}>
              {cargando ? 'Procesando...' : 'Confirmar Cobro'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default ModalRegistrarPago;