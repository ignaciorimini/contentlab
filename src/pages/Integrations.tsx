import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { 
  Instagram, 
  Linkedin, 
  Twitter, 
  Globe, 
  Plus, 
  Trash2, 
  CheckCircle2,
  AlertCircle,
  X,
  Loader2
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import './Integrations.css';

const Integrations = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // ENV variables para Facebook/Instagram
  const FACEBOOK_CLIENT_ID = import.meta.env.VITE_FACEBOOK_CLIENT_ID || '';
  const REDIRECT_URI = window.location.origin + '/integrations';

  useEffect(() => {
    fetchAccounts();
    handleOAuthCallbacks();
  }, []);

  const handleOAuthCallbacks = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state === 'instagram_auth') {
      // Estamos volviendo de Meta OAuth
      setLoading(true);
      setError('Recibimos el código de autorización de Meta. Próximo paso: Procesarlo en una Supabase Edge Function...');
      
      // Limpiamos la URL para no volver a ejecutar esto
      setSearchParams({});
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error: fetchError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', user.id);
      
      if (!fetchError && data) {
        setAccounts(data);
      }
    }
    setLoading(false);
  };

  const handleConnect = (platform: string) => {
    if (platform === 'instagram') {
      if (!FACEBOOK_CLIENT_ID) {
        setError('Falta el VITE_FACEBOOK_CLIENT_ID en el archivo .env');
        return;
      }
      
      // Para publicar en IG, se exige usar la API de Facebook Graph y que el IG sea cuenta Profesional vinculada a una Fanpage.
      const scopes = [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement'
      ].join(',');

      const facebookOAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=instagram_auth&scope=${scopes}&response_type=code`;
      
      window.location.href = facebookOAuthUrl;
      return;
    }

    // Modal MVP para las demás redes mientras tanto
    setSelectedPlatform(platform);
    setAccountName('');
    setAccessToken('');
    setIsModalOpen(true);
    setError('');
  };

  const saveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName || !accessToken) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");

      const { data, error: insertError } = await supabase
        .from('social_accounts')
        .insert({
          user_id: user.id,
          platform: selectedPlatform,
          account_name: accountName,
          access_token: accessToken,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      setAccounts([...accounts, data]);
      setIsModalOpen(false);
    } catch (err: any) {
      setError('Error al guardar la cuenta: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas desconectar esta cuenta?')) return;
    
    try {
      const { error } = await supabase
        .from('social_accounts')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      setAccounts(accounts.filter(a => a.id !== id));
    } catch (err: any) {
      setError('Error al desconectar: ' + err.message);
    }
  };

  const renderPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return <Instagram size={24} color="#E1306C" />;
      case 'linkedin': return <Linkedin size={24} color="#0A66C2" />;
      case 'twitter': return <Twitter size={24} color="#1DA1F2" />;
      case 'wordpress': return <Globe size={24} color="#21759B" />;
      default: return <Globe size={24} />;
    }
  };

  const platforms = [
    { id: 'instagram', name: 'Instagram', desc: 'Publica imágenes y carruseles' },
    { id: 'linkedin', name: 'LinkedIn', desc: 'Comparte posteos profesionales' },
    { id: 'twitter', name: 'Twitter / X', desc: 'Envía tweets rápidos' },
    { id: 'wordpress', name: 'WordPress', desc: 'Publica entradas en tu blog' }
  ];

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content integrations-page">
        <header className="dashboard-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <h1 style={{ color: 'white', fontSize: '2rem', margin: 0 }}>Integraciones 🔌</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Vincula tus redes sociales para publicar contenido directamente desde Content Lab.</p>
        </header>

        {error && (
          <div className="error-message" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <section className="integrations-section">
          <h2 className="section-title">Cuentas Conectadas</h2>
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Cargando cuentas...</div>
          ) : accounts.length > 0 ? (
            <div className="accounts-grid">
              {accounts.map(acc => (
                <div key={acc.id} className="account-card connected">
                  <div className="acc-header">
                    <div className="acc-icon-wrap bg-white/10">
                      {renderPlatformIcon(acc.platform)}
                    </div>
                    <span className="acc-status"><CheckCircle2 size={14} /> Conectado</span>
                  </div>
                  <h3 className="acc-name">{acc.account_name || 'Cuenta vinculada'}</h3>
                  <p className="acc-platform">{acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)}</p>
                  
                  <div className="acc-actions">
                    <button onClick={() => handleDisconnect(acc.id)} className="btn-disconnect">
                      <Trash2 size={14} /> Desconectar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No tienes cuentas vinculadas aún.</p>
            </div>
          )}
        </section>

        <section className="integrations-section" style={{ marginTop: '3rem' }}>
          <h2 className="section-title">Plataformas Disponibles</h2>
          <div className="platforms-grid">
            {platforms.map(platform => {
              const connectedCount = accounts.filter(a => a.platform === platform.id).length;
              
              return (
                <div key={platform.id} className="platform-card">
                  <div className="platform-icon">
                    {renderPlatformIcon(platform.id)}
                  </div>
                  <div className="platform-info">
                    <h3>{platform.name}</h3>
                    <p>{platform.desc}</p>
                  </div>
                  <div className="platform-action">
                    <button onClick={() => handleConnect(platform.id)} className="btn-connect">
                      <Plus size={16} /> Agregar
                    </button>
                    {connectedCount > 0 && (
                      <span className="connected-badge">{connectedCount} cuenta{connectedCount > 1 ? 's' : ''} vinculada{connectedCount > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Modal de Conexión Manual */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>
              <X size={20} />
            </button>
            
            <div className="modal-header">
              <div className="modal-icon">
                {renderPlatformIcon(selectedPlatform)}
              </div>
              <h2>Conectar a {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}</h2>
              <p>Por ahora (versión MVP), pega tu Access Token manualmente. En el futuro esto será un botón de "Iniciar Sesión" con OAuth automático.</p>
            </div>

            <form onSubmit={saveConnection} className="modal-form">
              <div className="form-group">
                <label>Nombre de la Cuenta (Ej: @mi_marca)</label>
                <input 
                  type="text" 
                  value={accountName} 
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Ej: @contentlab"
                  required
                />
              </div>

              <div className="form-group">
                <label>Access Token / API Key</label>
                <input 
                  type="password" 
                  value={accessToken} 
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Pega tu token aquí..."
                  required
                />
                <small className="form-hint">Obtén este token desde el portal de desarrolladores de la plataforma.</small>
              </div>

              <button type="submit" className="btn-save" disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar Conexión'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Integrations;
