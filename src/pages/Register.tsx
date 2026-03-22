import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Component, Github, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

    const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    setLoading(false);
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
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Unlock the power of AI-driven creativity.</p>
          </div>

          {error && <div style={{ color: '#ff4d4d', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input 
                type="text" 
                name="fullName"
                className="input" 
                placeholder="Enter your name" 
                value={formData.fullName}
                onChange={handleChange}
                required 
              />
            </div>

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

            <div className="pwd-grid">
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-icon-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password"
                    className="input" 
                    placeholder="Min. 8 chars" 
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

              <div className="input-group">
                <label className="input-label">Confirm</label>
                <div className="input-icon-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="confirmPassword"
                    className="input" 
                    placeholder="Repeat password" 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                  {showPassword ? 
                    <EyeOff size={16} onClick={() => setShowPassword(false)} /> : 
                    <Eye size={16} onClick={() => setShowPassword(true)} />
                  }
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>
          </form>

          <div className="separator">OR SIGN UP WITH</div>

          <div className="social-btns">
            <button className="btn btn-outline">
              <Mail size={16} /> Google
            </button>
            <button className="btn btn-outline" style={{width:'100%'}}>
              <Github size={16} /> GitHub
            </button>
          </div>

          <div className="auth-footer">
            Already have an account? <a href="/login" className="auth-link">Log in</a>
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

export default Register;
