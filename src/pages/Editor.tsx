import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CarouselEditor from '../components/CarouselEditor';
import type { EditableSlide } from '../components/CarouselEditor';

const EditorPage = () => {
  const [slides, setSlides] = useState<EditableSlide[] | null>(null);
  const [size, setSize] = useState({ width: 1080, height: 1080 });

  useEffect(() => {
    try {
      const storedSlides = localStorage.getItem('contentlab-editable-slides');
      const storedRatio = localStorage.getItem('contentlab-editable-ratio');
      
      if (storedSlides) {
        setSlides(JSON.parse(storedSlides));
      }

      if (storedRatio === '16:9') setSize({ width: 1920, height: 1080 });
      else if (storedRatio === '9:16') setSize({ width: 1080, height: 1920 });
      else setSize({ width: 1080, height: 1080 });

    } catch (e) {
      console.error(e);
    }
  }, []);

  const navigate = useNavigate();

  if (!slides) {
    return (
      <div className="app-container">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-darker)' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-color)' }}>No hay datos para editar</h2>
            <p style={{ marginBottom: '1.5rem' }}>Vuelve y genera un carrusel en Diseño HTML.</p>
            <button 
              onClick={() => navigate('/create')}
              className="btn-primary" 
              style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              Ir a Crear Contenido
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '0', overflow: 'hidden', background: 'var(--bg-darker)' }}>
        <header style={{ padding: '1rem 2rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.25rem', margin: 0 }}>Editor Visual Dinámico</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', margin: 0 }}>Basado en tu imagen de referencia</p>
          </div>
          <button 
            onClick={() => navigate('/create')}
            className="btn-outline" 
            style={{ fontSize: '0.85rem' }}
          >
            ← Volver a Generación
          </button>
        </header>
        
        <div style={{ flex: 1, padding: '1.5rem', display: 'flex' }}>
           <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
             <CarouselEditor slides={slides} onSave={() => {}} width={size.width} height={size.height} />
           </div>
        </div>
      </main>
    </div>
  );
};

export default EditorPage;
