import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';
import './CarouselEditor.css';

export interface EditableSlide {
  id: string;
  html: string;
}

interface CarouselEditorProps {
  slides: EditableSlide[];
  onSave: (slides: EditableSlide[]) => void;
  width?: number;
  height?: number;
}

const CarouselEditor = ({ slides: initialSlides, onSave, width = 1080, height = 1080 }: CarouselEditorProps) => {
  const [slides, setSlides] = useState<EditableSlide[]>(initialSlides);
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const currentSlide = slides[currentSlideIdx];

  // Scale computation to fit preview
  const scale = 500 / height; // e.g., if height is 1080, scale it down so it fits nicely
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  // Habilitar edición de texto en el HTML
  useEffect(() => {
    if (editorRef.current) {
      const textNodes = editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div.text');
      
      textNodes.forEach(node => {
        // Ignorar si es un div grande que es puramente estructural (solo queremos editar texto final).
        if (node.children.length === 0 || node.tagName !== 'DIV') {
            const htmlNode = node as HTMLElement;
            htmlNode.contentEditable = "true";
            htmlNode.style.outline = "none";
            htmlNode.style.cursor = "text";
            htmlNode.style.transition = "box-shadow 0.2s ease";
            
            // Efecto visual al tocar los textos
            htmlNode.addEventListener('focus', () => {
              htmlNode.style.boxShadow = "0 0 0 2px rgba(140, 43, 238, 0.5)";
              htmlNode.style.borderRadius = "4px";
            });
            htmlNode.addEventListener('blur', () => {
              htmlNode.style.boxShadow = "none";
              
              // Actualizar el estado con el nuevo HTML
              setSlides(prev => {
                const copy = [...prev];
                // Agarramos el HTML completo del div principal después de la edición
                if (editorRef.current) {
                    copy[currentSlideIdx] = { ...copy[currentSlideIdx], html: editorRef.current.innerHTML };
                }
                return copy;
              });
              onSave(slides); // trigger callback
            });
        }
      });
    }
  }, [currentSlideIdx, slides]);

  const exportCurrentSlide = async () => {
    if (!editorRef.current) return;
    setIsExporting(true);

    try {
      // Create a temporary container to render full scale
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = width + 'px';
      container.style.height = height + 'px';
      // Inyectamos el HTML editado guardado
      container.innerHTML = `<div style="width: 100%; height: 100%; overflow: hidden;">${currentSlide.html}</div>`;
      document.body.appendChild(container);

      // Esperar brevemente para imágenes y fuentes
      await new Promise(r => setTimeout(r, 300));

      const canvas = await html2canvas(container, {
        scale: 1, 
        useCORS: true,
        logging: false,
      });

      document.body.removeChild(container);

      const link = document.createElement('a');
      link.download = `slide-${currentSlideIdx + 1}.png`;
      link.href = canvas.toDataURL('image/png', 0.9);
      link.click();
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="carousel-editor-container">
      <div className="editor-top-bar" style={{ justifyContent: 'space-between', padding: '0 20px' }}>
        <div className="slide-navigator">
          <button 
            disabled={currentSlideIdx === 0} 
            onClick={() => setCurrentSlideIdx(s => s - 1)}
          >
            ←
          </button>
          <span>Slide {currentSlideIdx + 1} / {slides.length}</span>
          <button 
            disabled={currentSlideIdx === slides.length - 1} 
            onClick={() => setCurrentSlideIdx(s => s + 1)}
          >
            →
          </button>
        </div>
        
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--primary)', borderRadius: '50%' }}></span>
             Haz clic en cualquier texto para editarlo
        </div>

        <div className="editor-actions">
          <button onClick={exportCurrentSlide} disabled={isExporting} className="btn-editor-primary">
            {isExporting ? 'Exportando...' : <><Download size={14} /> Descargar Slide</>}
          </button>
        </div>
      </div>

      <div className="editor-workspace">
        <div className="editor-canvas-wrapper">
          <div 
            style={{ 
              width: width, 
              height: height,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              overflow: 'hidden',
              backgroundColor: '#0a050f',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              borderRadius: '8px'
            }}
          >
             {/* El propio div sirve de contenedor editable seguro */}
             <div 
                ref={editorRef}
                style={{ width: '100%', height: '100%' }}
                dangerouslySetInnerHTML={{ __html: currentSlide?.html || '' }} 
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarouselEditor;
