import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const CargaMasiva = () => {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState('');

  // La lista de jugadores procesada
  const jugadores = [
    // === ARQUEROS ===
    { nombreCompleto: "Rumi Paiva Edi Raul", celular: "927418748", posicion: "Arquero" },
    { nombreCompleto: "Andy Ruiz Ayala", celular: "983377608", posicion: "Arquero" },
    { nombreCompleto: "Coveñas More Oscar", celular: "", posicion: "Arquero" },

    // === DEFENSAS ===
    { nombreCompleto: "Gian Franco Loro Morales", celular: "", posicion: "Defensa" },
    { nombreCompleto: "Alexander Curo Ayala", celular: "998281076", posicion: "Defensa" },
    { nombreCompleto: "Jeferson Curo Anton", celular: "904282247", posicion: "Defensa" },
    { nombreCompleto: "Dennis Paiva Anton", celular: "969878614", posicion: "Defensa" },
    { nombreCompleto: "Xavi Max Saba Chunga", celular: "924959631", posicion: "Defensa" },
    { nombreCompleto: "Cristhoper Adrian Morales R.", celular: "", posicion: "Defensa" },
    { nombreCompleto: "Ruiz Zeta Eswin", celular: "961358902", posicion: "Defensa" },
    { nombreCompleto: "Lionel Paiva Loro", celular: "934248786", posicion: "Defensa" },
    { nombreCompleto: "Chunga Chapilliquen Carlos Josue", celular: "934037276", posicion: "Defensa" },
    { nombreCompleto: "Ruiz Purizaca Jersi Lionel", celular: "", posicion: "Defensa" },
    { nombreCompleto: "Paiva Masias Evert", celular: "922108972", posicion: "Defensa" },
    { nombreCompleto: "Aron Paiba", celular: "963353293", posicion: "Defensa" },
    { nombreCompleto: "Edgar Chunga Nunura", celular: "923622458", posicion: "Defensa" },
    { nombreCompleto: "Esdras Alessandro Ramirez A", celular: "945200049", posicion: "Defensa" },

    // === VOLANTES ===
    { nombreCompleto: "David Chunga Saba", celular: "938507231", posicion: "Volante" },
    { nombreCompleto: "Junior Quiroga Paico", celular: "927345183", posicion: "Volante" },
    { nombreCompleto: "Jose Ayala Sernaqué", celular: "921701213", posicion: "Volante" },
    { nombreCompleto: "Joseph Hernandez Chunga", celular: "936961749", posicion: "Volante" },
    { nombreCompleto: "Erick Cortez Panta", celular: "960654206", posicion: "Volante" },
    { nombreCompleto: "Emerson Sanchez Jacinto", celular: "907202371", posicion: "Volante" },
    { nombreCompleto: "Lionel Ludeño", celular: "972951121", posicion: "Volante" },
    { nombreCompleto: "Freddy Loro Rumiche", celular: "998257699", posicion: "Volante" },
    { nombreCompleto: "Jhosmar Ayala Sernaqué", celular: "918404019", posicion: "Volante" },
    { nombreCompleto: "Xavi Cobeñas Apaestegui", celular: "912624725", posicion: "Volante" },
    { nombreCompleto: "Dayron Ruiz Curo", celular: "970124552", posicion: "Volante" },
    { nombreCompleto: "Sammir Periche Castro", celular: "918809110", posicion: "Volante" },
    { nombreCompleto: "Ballona Chapilliquen Luis Jeanpie", celular: "935196664", posicion: "Volante" },
    { nombreCompleto: "Rumiche Purizaca Franklin", celular: "973324575", posicion: "Volante" },
    { nombreCompleto: "Jhonathan Jesús Jones", celular: "972595071", posicion: "Volante" },
    { nombreCompleto: "Loro Sahuanga Max", celular: "958501054", posicion: "Volante" },
    { nombreCompleto: "Gomez Bancayan Iker", celular: "900549051", posicion: "Volante" },
    { nombreCompleto: "Dios Benites James Raul", celular: "", posicion: "Volante" },
    { nombreCompleto: "Loro Curo Nicola David", celular: "982766373", posicion: "Volante" },
    { nombreCompleto: "Fiesta Morales Ercik Silvestre", celular: "973469210", posicion: "Volante" },
    { nombreCompleto: "Cherre Ancuero Ronal", celular: "954485967", posicion: "Volante" },
    { nombreCompleto: "Tiago Daniel Soba Paiba", celular: "928016226", posicion: "Volante" },

    // === DELANTEROS ===
    { nombreCompleto: "Ayala Marcial Andreé", celular: "919653481", posicion: "Delantero" },
    { nombreCompleto: "Jansita Morales Denis Samir", celular: "940004604", posicion: "Delantero" },
    { nombreCompleto: "Jerson Neymar Chunga Morales", celular: "933901659", posicion: "Delantero" },
    { nombreCompleto: "Chapilliquen Neymar Jael", celular: "933901659", posicion: "Delantero" },
    { nombreCompleto: "Samir Periche Castro", celular: "934057276", posicion: "Delantero" },
    { nombreCompleto: "Darlin Calderon Chunga", celular: "961714281", posicion: "Delantero" },
    { nombreCompleto: "Lionel Ludeño Ayala", celular: "972951121", posicion: "Delantero" },
    { nombreCompleto: "Didier Gomez Alcantaro", celular: "938507231", posicion: "Delantero" },
    { nombreCompleto: "David Chunga Saba", celular: "945200049", posicion: "Delantero" },
    { nombreCompleto: "Alessandro Ramirez Ayala", celular: "964744281", posicion: "Delantero" },
    { nombreCompleto: "Jedgard Chunga Nunura", celular: "", posicion: "Delantero" }
  ];

  const ejecutarCarga = async () => {
    setCargando(true);
    setResultado('Iniciando carga de datos...');
    const alumnosCollectionRef = collection(db, 'alumnos');
    let agregados = 0;
    let errores = 0;

    const opciones = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
    const partes = new Intl.DateTimeFormat('es-PE', opciones).formatToParts(new Date());
    const hoy = `${partes.find(p => p.type === 'year').value}-${partes.find(p => p.type === 'month').value}-${partes.find(p => p.type === 'day').value}`;
    
    // Nace como moroso al igualar inscripción = vencimiento
    const vencimiento = hoy; 

    for (const jugador of jugadores) {
      const partesNombre = jugador.nombreCompleto.split(' ');
      const apellido = partesNombre.length > 1 ? partesNombre[0] : jugador.nombreCompleto;
      const nombre = partesNombre.length > 1 ? partesNombre.slice(1).join(' ') : '';

      const nuevoAlumnoData = {
        nombre: nombre,
        apellido: apellido,
        celular: jugador.celular,
        posicion: jugador.posicion,
        categoria: '6', // Cat por defecto
        dni: '',
        edad: '',
        fechaNacimiento: '',
        colegio: '',
        distrito: 'Bernal', // <=== SE INSERTAN COMO DE BERNAL
        ciudad: 'Sechura',  // <=== CIUDAD BASE
        direccion: '',
        apoderado: '',
        foto: null,
        fechaInscripcion: hoy,
        vencimientoMensualidad: vencimiento, 
        createdAt: serverTimestamp()
      };

      try {
        await addDoc(alumnosCollectionRef, nuevoAlumnoData);
        agregados++;
        setResultado(`Cargados: ${agregados} / ${jugadores.length}`);
      } catch (error) {
        console.error("Error al agregar a ", jugador.nombreCompleto, error);
        errores++;
      }
    }

    setCargando(false);
    setResultado(`Carga completada. Agregados: ${agregados}. ¡Todos están como PENDIENTES y del distrito de BERNAL!`);
  };

  return (
    <div className="container py-5 text-center mt-5">
      <div className="card shadow-lg p-5 border-0 rounded-4 mx-auto" style={{maxWidth: '600px'}}>
        <h2 className="fw-black text-primary mb-3">Herramienta de Carga Masiva (Bernal)</h2>
        <p className="text-muted mb-4">Se van a cargar <strong>{jugadores.length}</strong> jugadores a la base de datos.</p>
        
        {resultado && (
          <div className={`alert ${cargando ? 'alert-warning' : 'alert-success'} fw-bold mb-4`}>
            {resultado}
          </div>
        )}

        <button 
          className="btn btn-danger btn-lg rounded-pill px-5 fw-bold shadow" 
          onClick={ejecutarCarga} 
          disabled={cargando}
        >
          {cargando ? (
            <><span className="spinner-border spinner-border-sm me-2"></span> Cargando a Firebase...</>
          ) : (
            <><i className="fas fa-upload me-2"></i> Iniciar Carga (Distrito: Bernal)</>
          )}
        </button>
      </div>
    </div>
  );
};

export default CargaMasiva;