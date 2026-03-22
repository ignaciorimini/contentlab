import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Component, Github, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Register.css'; // Reuse the register styling for 50/50 layout

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/drive.readonly'
      }
    });
    if (error) setError(error.message);
  };

  return (
    <div className="auth-container">
      {/* Left Form Section */}
      <div className="auth-form-section">
        <div className="auth-form-inner">
          <div className="logo">
            <div className="logo-icon">
              <Component size={20} />
            </div>
            Content Lab
          </div>

          <div className="auth-header">
            <h1 className="auth-title">Log in to your account</h1>
            <p className="auth-subtitle">Welcome back to Content Lab.</p>
          </div>

          {error && <div style={{ color: '#ff4d4d', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input 
                type="email" 
                name="email"
                className="input" 
                placeholder="name@company.com" 
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="input-label">Password</label>
                <a href="#" className="auth-link" style={{ fontSize: '0.75rem' }}>Forgot password?</a>
              </div>
              <div className="input-icon-wrapper">
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password"
                  className="input" 
                  placeholder="Enter your password" 
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                {showPassword ? 
                  <EyeOff size={16} onClick={() => setShowPassword(false)} /> : 
                  <Eye size={16} onClick={() => setShowPassword(true)} />
                }
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In →'}
            </button>
          </form>

          <div className="separator">OR LOG IN WITH</div>

          <div className="social-btns">
            <button onClick={handleGoogleLogin} className="btn btn-outline" style={{ width: '100%' }}>
              <Mail size={16} /> Google
            </button>
          </div>

          <div className="social-btns">
            <button className="btn btn-outline" style={{width:'100%'}}>
              <Github size={16} /> GitHub
            </button>
          </div>

          <div className="auth-footer">
            Don't have an account? <a href="/register" className="auth-link">Sign up</a>
          </div>
        </div>
      </div>

      {/* Right Hero Section */}
      <div className="auth-hero-section">
        <div className="auth-hero-content">
          <div className="auth-hero-card">
            <div className="auth-hero-badge">
              <span style={{ fontSize: '6px', color: 'var(--primary)', marginRight: '4px' }}>●</span>
              AI POWERED PLATFORM
            </div>
            <h2 className="auth-hero-title">Transform your workflow with Content Lab</h2>
            <p className="auth-hero-subtitle">
              Join over 50,000 creators using our neural networks to generate stunning visuals, copy, and code in seconds.
            </p>
            
            <div className="auth-hero-stats">
              <div className="auth-hero-avatars">
                <div className="auth-hero-avatar"><img src="https://i.pravatar.cc/100?img=11" alt="avatar" style={{width: 32, height: 32, borderRadius: '50%'}}/></div>
                <div className="auth-hero-avatar"><img src="https://i.pravatar.cc/100?img=12" alt="avatar" style={{width: 32, height: 32, borderRadius: '50%'}}/></div>
                <div className="auth-hero-avatar"><img src="https://i.pravatar.cc/100?img=5" alt="avatar" style={{width: 32, height: 32, borderRadius: '50%'}}/></div>
                <div className="auth-hero-avatar" style={{fontSize: '10px'}}>+2K</div>
              </div>
              <span style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>New users today</span>
            </div>
          </div>
        </div>

        <div className="system-status">
          <Sparkles className="status-icon" size={20} />
          <div>
            <div className="status-label">System Status</div>
            <div className="status-text">All Models Operational</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
