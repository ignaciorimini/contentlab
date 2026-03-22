import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { 
  ArrowLeft, 
  Download, 
  Copy, 
  Share2, 
  Sparkles, 
  Clipboard,
  Calendar,
  Type
} from 'lucide-react';
import './ContentDetail.css';

const ContentDetail = () => {
  const { id } = useParams();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching content:', error);
      } else {
        setContent(data);
      }
      setLoading(false);
    };

    fetchContent();
  }, [id]);

  const handleCopyText = () => {
    if (content?.description) {
      navigator.clipboard.writeText(content.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="detail-container">
        <Sidebar />
        <main className="detail-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-muted)' }}>Cargando detalles...</div>
        </main>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="detail-container">
        <Sidebar />
        <main className="detail-content">
          <Link to="/dashboard" className="back-link">
            <ArrowLeft size={16} /> Volver al Dashboard
          </Link>
          <div style={{ color: 'white', textAlign: 'center', marginTop: '4rem' }}>
            <h1>Contenido no encontrado</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Parece que este recurso ya no existe.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="detail-container">
      <Sidebar />
      <main className="detail-content">
        <Link to="/dashboard" className="back-link">
          <ArrowLeft size={16} /> Volver al Dashboard
        </Link>

        <div className="detail-grid">
          <div className="detail-visual">
            <div className="detail-image-wrapper">
              <img src={content.image_url} alt={content.title} className="detail-image" />
            </div>
          </div>

          <div className="detail-info">
            <div className="detail-header-section">
              <span className={`card-badge ${content.content_type.toLowerCase()}`} style={{ display: 'inline-block', marginBottom: '1rem' }}>
                {content.content_type}
              </span>
              <h1>{content.title}</h1>
              <div className="detail-meta">
                <Calendar size={14} />
                <span>{formatDate(content.created_at)}</span>
              </div>
            </div>

            <div className="prompt-section">
              <span className="section-label">
                <Sparkles size={14} /> Prompt Original
              </span>
              <div className="prompt-box">
                "{content.prompt || 'Sin prompt guardado.'}"
              </div>
            </div>

            <div className="content-section">
              <span className="section-label">
                <Type size={14} /> Texto Generado
              </span>
              <div className="content-box">
                <p className="detail-body">{content.description}</p>
                <div className="detail-actions">
                  <button onClick={handleCopyText} className={`btn-detail ${copied ? 'outline' : 'primary'}`}>
                    {copied ? <><Clipboard size={16} /> ¡Copiado!</> : <><Copy size={16} /> Copiar Texto</>}
                  </button>
                  <button className="btn-detail outline">
                    <Download size={16} /> Descargar Imagen
                  </button>
                  <button className="btn-detail outline">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContentDetail;
