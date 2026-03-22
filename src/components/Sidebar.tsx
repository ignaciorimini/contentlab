import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  Folder, 
  Database,
  Settings,
  Sparkles,
  LogOut,
  Plus,
  ShoppingBag,
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('User Profile');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-box">
            <Sparkles size={18} />
          </div>
          <div className="logo-text">
            <h2>Content Lab</h2>
            <span>AI ENGINE</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <Link 
          to="/create" 
          className="nav-item nav-item-create"
        >
          <Plus size={18} />
          Crear Contenido
        </Link>
        
        <div style={{ marginBottom: '1rem' }}></div>

        <Link 
          to="/dashboard" 
          className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </Link>
        <Link 
          to="#" 
          className={`nav-item ${location.pathname === '/projects' ? 'active' : ''}`}
        >
          <Folder size={18} />
          Projects
        </Link>
        <Link 
          to="#" 
          className={`nav-item ${location.pathname === '/assets' ? 'active' : ''}`}
        >
          <Database size={18} />
          Assets
        </Link>
        <Link 
          to="/settings" 
          className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
        >
          <Settings size={18} />
          Settings
        </Link>
        <Link 
          to="/marketplace" 
          className={`nav-item ${location.pathname === '/marketplace' ? 'active' : ''}`}
        >
          <ShoppingBag size={18} />
          Marketplace
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <img src="https://i.pravatar.cc/100?img=3" alt="User" />
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-plan">Pro Plan</span>
          </div>
          <button onClick={handleLogout} className="logout-mini-btn" title="Log Out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
