import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import {
  ArrowLeft,
  Download,
  Copy,
  Sparkles,
  Clipboard,
  Calendar,
  Type,
  Send,
  X,
  Instagram,
  Linkedin,
  Twitter,
  Globe
} from 'lucide-react';
import './ContentDetail.css';

const ContentDetail = () => {
  const { id } = useParams();
  const [content, setContent] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Publish Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      // Fetch social accounts
      const { data: accData } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', user.id);

      if (accData) setAccounts(accData);

      setLoading(false);
    };

    fetchContent();
  }, [id]);

  // El handler original ha sido movido hacia abajo donde variables están definidas

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

  let isCarousel = content.content_type === 'CAROUSEL';
  let carouselSlides: any[] = [];
  let socialText = content.description;

  if (isCarousel && content.description) {
    try {
      carouselSlides = JSON.parse(content.description);
    } catch (e) {
      console.error("Failed to parse carousel slides");
    }
  } else if (!isCarousel && content.description) {
    try {
      // In case the AI outputted raw JSON instead of plain string
      const parsed = JSON.parse(content.description);
      if (parsed.TEXTO) socialText = parsed.TEXTO;
      else if (parsed.text) socialText = parsed.text;
    } catch (e) {
      // It's a plain string, do nothing
    }
  }

  const handleCopyText = () => {
    let textToCopy = socialText;
    if (isCarousel && carouselSlides.length > 0) {
      textToCopy = carouselSlides[currentSlide]?.text || socialText;
    }
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePublish = async () => {
    if (!selectedAccountId) {
      setPublishStatus({ type: 'error', msg: 'Selecciona una red social primero.' });
      return;
    }

    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    setIsPublishing(true);
    setPublishStatus(null);
    try {
      let textToPublish = socialText;
      let imgToPublish = content.image_url;

      if (isCarousel && carouselSlides.length > 0) {
        textToPublish = carouselSlides[0].text;
        imgToPublish = carouselSlides[0].imageUrl;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          accountId: account.id,
          contentId: content.id,
          text: textToPublish,
          imageUrl: imgToPublish,
          platform: account.platform
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al publicar');

      setPublishStatus({ type: 'success', msg: data.message });
      setTimeout(() => setIsPublishModalOpen(false), 3000); // Cerrar luego de 3 segundos
    } catch (err: any) {
      setPublishStatus({ type: 'error', msg: err.message });
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  const renderPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return <Instagram size={18} color="#E1306C" />;
      case 'linkedin': return <Linkedin size={18} color="#0A66C2" />;
      case 'twitter': return <Twitter size={18} color="#1DA1F2" />;
      case 'wordpress': return <Globe size={18} color="#21759B" />;
      default: return <Globe size={18} />;
    }
  };

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
              {isCarousel && carouselSlides.length > 0 ? (
                <>
                  <img src={carouselSlides[currentSlide].imageUrl} alt={`Slide ${currentSlide + 1}`} className="detail-image" />
                  <div className="slide-nav" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
                    <button disabled={currentSlide === 0} onClick={() => setCurrentSlide(s => s - 1)} className="btn-detail outline" style={{ padding: '0.4rem 0.8rem' }}>←</button>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>Slide {currentSlide + 1} / {carouselSlides.length}</span>
                    <button disabled={currentSlide === carouselSlides.length - 1} onClick={() => setCurrentSlide(s => s + 1)} className="btn-detail outline" style={{ padding: '0.4rem 0.8rem' }}>→</button>
                  </div>
                </>
              ) : (
                <img src={content.image_url} alt={content.title} className="detail-image" />
              )}
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
                <p className="detail-body">
                  {isCarousel && carouselSlides.length > 0 ? carouselSlides[currentSlide]?.text : socialText}
                </p>
                <div className="detail-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button onClick={handleCopyText} className={`btn-detail ${copied ? 'outline' : 'primary'}`}>
                    {copied ? <><Clipboard size={16} /> ¡Copiado!</> : <><Copy size={16} /> Copiar Texto</>}
                  </button>
                  <button onClick={() => {
                    const link = document.createElement('a');
                    link.href = isCarousel && carouselSlides.length > 0 ? carouselSlides[currentSlide]?.imageUrl : content.image_url;
                    link.download = `contentlab-image-${isCarousel ? currentSlide + 1 : 1}.png`;
                    link.click();
                  }} className="btn-detail outline">
                    <Download size={16} /> {isCarousel ? 'Descargar Slide' : 'Descargar Imagen'}
                  </button>
                  {isCarousel && carouselSlides.length > 1 && (
                    <button onClick={() => {
                      carouselSlides.forEach((slide, i) => {
                        // Timeout to prevent browser from blocking multiple rapid downloads
                        setTimeout(() => {
                          const link = document.createElement('a');
                          link.href = slide.imageUrl;
                          link.download = `contentlab-slide-${i + 1}.png`;
                          link.click();
                        }, i * 300);
                      });
                    }} className="btn-detail outline">
                      <Download size={16} /> Descargar Todo
                    </button>
                  )}
                  <button onClick={() => setIsPublishModalOpen(true)} className="btn-detail primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto', background: '#gradient', backgroundColor: 'var(--primary)', borderColor: 'transparet' }}>
                    <Send size={16} /> Publicar ahora
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Publicación */}
      {isPublishModalOpen && (
        <div className="publish-modal-overlay">
          <div className="publish-modal-content">
            <button className="publish-modal-close" onClick={() => setIsPublishModalOpen(false)} disabled={isPublishing}>
              <X size={20} />
            </button>
            <div className="publish-modal-header">
              <h2>¿Dónde quieres publicar el contenido?</h2>
              <p>Selecciona una red conectada para enviar tu imagen y texto instantáneamente.</p>
            </div>

            {publishStatus?.type === 'error' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {publishStatus.msg}
              </div>
            )}

            {publishStatus?.type === 'success' && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>
                {publishStatus.msg} 🚀
              </div>
            )}

            {!publishStatus || publishStatus.type === 'error' ? (
              <>
                <div className="accounts-list-selection">
                  {accounts.length > 0 ? (
                    accounts.map(acc => (
                      <div
                        key={acc.id}
                        className={`account-select-card ${selectedAccountId === acc.id ? 'selected' : ''}`}
                        onClick={() => setSelectedAccountId(acc.id)}
                      >
                        <div className="acc-icon-mini bg-white/10">
                          {renderPlatformIcon(acc.platform)}
                        </div>
                        <div className="acc-info-mini">
                          <h4 style={{ margin: 0, color: 'white', fontSize: '0.95rem' }}>{acc.account_name}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.platform.toUpperCase()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No tienes cuentas vinculadas. <br />
                      <Link to="/integrations" style={{ color: 'var(--primary)', marginTop: '0.5rem', display: 'inline-block' }}>Ir a Integraciones</Link>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                  <button
                    onClick={handlePublish}
                    className="btn-publish-final"
                    disabled={isPublishing || accounts.length === 0 || !selectedAccountId}
                  >
                    {isPublishing ? 'Enviando...' : 'Publicar post'} <Send size={16} style={{ marginLeft: '4px' }} />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentDetail;
