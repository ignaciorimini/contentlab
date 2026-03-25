import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Bell, Plus, Copy, MoreVertical, Download, Share2, Play } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import './Dashboard.css';

const Dashboard = () => {
  const [userName, setUserName] = useState('User');
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name.split(' ')[0]);
      }

      if (user) {
        // Fetch only the latest 8 items to improve performance
        const { data, count, error } = await supabase
          .from('content')
          .select('id, title, content_type, created_at, image_url, description', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(0, 7);

        if (!error && data) {
          setContents(data);
          setTotalCount(count || 0);
        }
      }
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1>Bienvenido, {userName} 🙌</h1>
            <p>Ready to create something amazing today?</p>
          </div>

          <div className="header-actions">
            <div className="search-bar">
              <Search className="search-icon" size={16} />
              <input type="text" placeholder="Search content..." />
            </div>
            <button className="btn-icon">
              <Bell size={18} />
            </button>
            <Link to="/create" className="btn btn-primary" style={{ height: '40px', padding: '0 1rem', display: 'flex', alignItems: 'center' }}>
              <Plus size={18} /> Create New
            </Link>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">Total Assets</div>
            <div className="stat-value">{totalCount}</div>
            <div className="stat-trend trend-up">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
              12% this month
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">AI Generations</div>
            <div className="stat-value">{totalCount}</div>
            <div className="stat-trend trend-up">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
              24% this month
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Storage Used</div>
            <div className="stat-value">12%</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '12%' }}></div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-title">Active Projects</div>
            <div className="stat-value">3</div>
            <div className="stat-trend trend-neutral">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Updated 2h ago
            </div>
          </div>
        </div>

        <section className="generated-content">
          <div className="content-header">
            <div className="content-title">
              <Copy size={18} color="var(--primary)" /> Generated Content
            </div>

            <div className="content-filters">
              <button className="filter-btn active">All Content</button>
              <button className="filter-btn">Images</button>
              <button className="filter-btn">Social Posts</button>
            </div>
          </div>

          <div className="content-grid">
            {loading ? (
              <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Cargando contenido...</div>
            ) : (
              <>
                {contents.length > 0 ? (
                  contents.map((item) => {
                    let desc = item.description;
                    if (item.content_type === 'CAROUSEL') {
                      try {
                        const slides = JSON.parse(item.description);
                        desc = slides[0]?.text || item.description;
                      } catch (e) {
                         // Fallback to original
                      }
                    }
                    
                    return (
                      <Link key={item.id} to={`/content/${item.id}`} className="content-card" style={{ textDecoration: 'none' }}>
                        <div className="card-image-wrapper">
                          <img src={item.image_url || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=2070&auto=format&fit=crop'} alt={item.title} className="card-image" />
                          <span className={`card-badge ${item.content_type.toLowerCase()}`}>{item.content_type}</span>
                        </div>
                        <div className="card-content">
                          <h3 className="card-title">{item.title}</h3>
                          <p className="card-desc">{desc?.slice(0, 80)}...</p>
                          <div className="card-footer">
                            <span>{formatDate(item.created_at)}</span>
                            <div className="card-actions">
                              <button className="card-action-btn"><Download size={14} /></button>
                              <button className="card-action-btn"><MoreVertical size={14} /></button>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <p>No hay contenido generado aún. ¡Empieza creando uno!</p>
                  </div>
                )}

                {/* New Generation Card */}
                <Link to="/create" className="new-generation-card" style={{ textDecoration: 'none' }}>
                  <div className="new-generation-icon">
                    <Plus size={24} />
                  </div>
                  <h3 className="new-generation-title">New Generation</h3>
                  <p className="new-generation-desc">Start fresh with AI</p>
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
