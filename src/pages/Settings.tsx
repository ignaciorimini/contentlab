import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { Key, Save, CheckCircle2, ChevronRight, Settings as SettingsIcon, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import './Settings.css';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [, setUser] = useState<User | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [apiKeys, setApiKeys] = useState({
    gemini_api_key: '',
    nano_banana_api_key: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);

      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setApiKeys({
          gemini_api_key: data.gemini_api_key || '',
          nano_banana_api_key: data.nano_banana_api_key || '',
        });
        // If we just came back from OAuth with a fresh token, save it
        if (session?.provider_token && session.provider_token !== data.google_access_token) {
          await supabase.from('user_settings')
            .update({ google_access_token: session.provider_token })
            .eq('user_id', user.id);
          setGoogleConnected(true);
        } else {
          setGoogleConnected(!!data.google_access_token || !!session?.provider_token ||
            (user.identities?.some(id => id.provider === 'google') ?? false));
        }
      } else {
        // No settings row yet - create one if we have a provider_token
        if (session?.provider_token) {
          await supabase.from('user_settings').insert({
            user_id: user.id,
            google_access_token: session.provider_token,
          });
          setGoogleConnected(true);
        } else {
          setGoogleConnected(user.identities?.some(id => id.provider === 'google') ?? false);
        }
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user settings already exist
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from('user_settings')
        .update({
          gemini_api_key: apiKeys.gemini_api_key,
          nano_banana_api_key: apiKeys.nano_banana_api_key,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    } else {
      result = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          gemini_api_key: apiKeys.gemini_api_key,
          nano_banana_api_key: apiKeys.nano_banana_api_key,
        });
    }

    if (result.error) {
      setSaveStatus('Error saving: ' + result.error.message);
    } else {
      setSaveStatus('Saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    }
    setLoading(false);
  };

  const handleLinkGoogle = async () => {
    setSaveStatus(null);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setSaveStatus('Error: Configura VITE_GOOGLE_CLIENT_ID en tu archivo .env');
      return;
    }

    const gis = (window as any).google?.accounts?.oauth2;
    if (!gis) {
      setSaveStatus('Error: Google Identity Services no cargó. Reintenta en unos segundos.');
      return;
    }

    const tokenClient = gis.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/drive.readonly',
      callback: async (response: any) => {
        if (response.error) {
          setSaveStatus('Error al vincular: ' + response.error);
          return;
        }

        // Save token to DB without changing Supabase session
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('user_settings')
          .upsert(
            { user_id: user.id, google_access_token: response.access_token },
            { onConflict: 'user_id' }
          );

        if (error) {
          setSaveStatus('Error guardando token: ' + error.message);
        } else {
          setGoogleConnected(true);
          setSaveStatus('¡Google vinculado exitosamente!');
          setTimeout(() => setSaveStatus(null), 3000);
        }
      }
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeys({ ...apiKeys, [e.target.name]: e.target.value });
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="settings-container">
          <header className="settings-header">
            <h1 className="settings-title">Configuración</h1>
            <p className="settings-subtitle">Administra tus credenciales y preferencias de IA.</p>
          </header>

          <section className="settings-card">
            <h2 className="settings-card-title">
              <Key size={20} color="var(--primary)" /> Credenciales de IA
            </h2>
            <form onSubmit={handleSave} className="settings-form">
              <div className="api-input-group">
                <label className="api-label">Gemini 2.5 Flash API Key</label>
                <div className="api-input-wrapper">
                  <input
                    type="password"
                    name="gemini_api_key"
                    className="api-input"
                    placeholder="Abcde12345..."
                    value={apiKeys.gemini_api_key}
                    onChange={handleChange}
                  />
                </div>
                {apiKeys.gemini_api_key ? (
                  <span className="status-badge saved"><CheckCircle2 size={12} /> Key cargada</span>
                ) : (
                  <span className="status-badge missing">No configurada</span>
                )}
              </div>

              <div className="api-input-group">
                <label className="api-label">Nano Banana 2 API Key</label>
                <div className="api-input-wrapper">
                  <input
                    type="password"
                    name="nano_banana_api_key"
                    className="api-input"
                    placeholder="Nb-12345678..."
                    value={apiKeys.nano_banana_api_key}
                    onChange={handleChange}
                  />
                </div>
                {apiKeys.nano_banana_api_key ? (
                  <span className="status-badge saved"><CheckCircle2 size={12} /> Key cargada</span>
                ) : (
                  <span className="status-badge missing">No configurada</span>
                )}
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <button type="submit" className="btn-generate" style={{ width: 'auto', padding: '0.8rem 2rem' }} disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Cambios'} <Save size={18} />
                </button>
                {saveStatus && (
                  <span style={{ 
                    fontSize: '0.875rem', 
                    color: saveStatus.includes('Error') ? '#ef4444' : '#10b981',
                    fontWeight: 600,
                  }}>{saveStatus}</span>
                )}
              </div>
            </form>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">
              <Mail size={20} color="var(--primary)" /> Conexiones de Terceros
            </h2>
            <div className="google-connection-status">
              <div className="connection-info">
                <div className="provider-icon google">
                  <Mail size={18} color="white" />
                </div>
                <div className="provider-details">
                  <span className="provider-name">Google Slides / Drive</span>
                  {googleConnected ? (
                    <span className="status-badge saved">Conectado</span>
                  ) : (
                    <span className="status-badge missing">No conectado</span>
                  )}
                </div>
              </div>
              <button onClick={handleLinkGoogle} className="btn-outline" style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}>
                {googleConnected ? 'Vincular de nuevo' : 'Vincular Google'}
              </button>
            </div>
            <p className="form-desc" style={{ marginTop: '1rem' }}>Nacesita esta conexión para poder importar tus Google Slides y modificarlos con IA.</p>
          </section>

          <section className="settings-card" style={{ opacity: 0.6 }}>
            <h2 className="settings-card-title">
              <SettingsIcon size={20} color="var(--primary)" /> Preferencias Generales
            </h2>
            <p className="form-desc" style={{ marginBottom: '1.5rem' }}>Estas opciones estarán disponibles en la próxima actualización.</p>
            <div className="model-option" style={{ cursor: 'default' }}>
              <div className="model-left">
                <span>Modo de generación predeterminado</span>
              </div>
              <ChevronRight size={18} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Settings;
