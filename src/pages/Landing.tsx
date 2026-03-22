import { Link } from 'react-router-dom';
import { Play, ArrowRight, Check } from 'lucide-react';
import './Landing.css';
import MockupImage from '../assets/mockup.png';

const Landing = () => {
  return (
    <div className="landing-page">

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-logo">ContentLab</div>
        <ul className="lp-nav-links">
          <li><a href="#features">Inicio</a></li>
          <li><a href="#pricing">Precios</a></li>
          <li><a href="#">Blog</a></li>
        </ul>
        <Link to="/register" className="lp-nav-cta">
          Comenzar <ArrowRight size={14} />
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <p className="lp-hero-eyebrow">Plataforma de Contenido IA</p>
        <h1 className="lp-hero-title">
          Reimagine Creativity<br />
          with <span className="gradient-text">Advanced AI</span>
        </h1>
        <p className="lp-hero-sub">
          Esta plataforma integra Gemini, Content-Lab hace que tus
          procesos de diseño y contenido sean 10 veces más rápidos.
          Creación instantánea. Al tust ready.
        </p>
        <div className="lp-hero-actions">
          <Link to="/register" className="btn-lp-primary">
            Start For Free
          </Link>
          <Link to="/login" className="btn-lp-ghost">
            See Demos of You
          </Link>
        </div>
      </section>

      {/* ── INSIDE THE LAB ── */}
      <section className="lp-preview-section" id="preview">
        <p className="lp-preview-label">Inside the Lab</p>
        <div className="lp-preview-frame">
          {/* Simulated app dashboard UI */}
          <div style={{ background: '#0c0a14', padding: '0', display: 'flex', height: '420px' }}>
            {/* Sidebar */}
            <div className="lp-dash-sidebar">
              <div className="lp-dash-sidebar-dot active"></div>
              <div className="lp-dash-sidebar-dot"></div>
              <div className="lp-dash-sidebar-dot"></div>
              <div className="lp-dash-sidebar-dot"></div>
              <div style={{ flex: 1 }}></div>
              <div className="lp-dash-sidebar-dot"></div>
            </div>
            {/* Main content */}
            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'hidden' }}>
              {/* Row of stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { num: '24', label: 'Total Assets' },
                  { num: '18', label: 'AI Generations' },
                  { num: '12%', label: 'Storage Used' },
                  { num: '3', label: 'Active Projects' },
                ].map((s) => (
                  <div key={s.label} className="lp-dash-card">
                    <div className="lp-dash-card-num">{s.num}</div>
                    <div className="lp-dash-card-label">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Prompt area hint */}
              <div style={{ padding: '12px 16px', background: 'rgba(157,78,221,0.08)', border: '1px solid rgba(157,78,221,0.2)', borderRadius: '10px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                Descripción, guía ai...
              </div>
              {/* Content cards row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', flex: 1 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '16/9', background: `linear-gradient(135deg, rgba(${i*50+50},${i*20},200,0.3), rgba(0,200,220,0.1))` }}></div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Carrusel {i}</div>
                      <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>AI Generated • Today</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Bottom bar */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)' }}>ContentLab AI — Dashboard</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="lp-stats">
        {[
          { num: '+1K', label: 'Questions' },
          { num: '98%', label: 'Replies' },
          { num: '50+', label: 'Tours' },
          { num: '200+', label: 'Answers' },
          { num: '12+', label: 'Tours' },
        ].map((s) => (
          <div key={s.label + s.num} className="lp-stat-item">
            <div className="lp-stat-num">{s.num}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── STEPS ── */}
      <section className="lp-steps-section" id="features">
        <h2 className="lp-section-title">From Idea to Reality in 5 Steps</h2>
        <div className="lp-steps-grid">
          {[
            {
              n: '1. Describe Your Vision',
              title: '1. Describe Your Vision',
              desc: 'Tell us about your content goals. ContentLab understands context and brand voice from your description.',
            },
            {
              n: '2. AI Magic Happens',
              title: '2. AI Magic Happens',
              desc: 'Our AI processes your request, researches the topic, and structures the perfect carousel or post.',
            },
            {
              n: '3. Refine & Deploy',
              title: '3. Refine & Deploy',
              desc: 'Review and customize the output. Export to Google Slides or download as assets, ready to publish.',
            },
          ].map((step) => (
            <div key={step.n} className="lp-step-card">
              <div className="lp-step-num">✦ {step.n.split('.')[0] + '.'}</div>
              <h3 className="lp-step-title">{step.title.replace(/^\d+\.\s*/, '')}</h3>
              <p className="lp-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE ROWS ── */}
      <div className="lp-features">

        {/* Feature 1 — Hyper-Realistic Image Synthesis */}
        <div className="lp-feature-row">
          <div className="lp-feature-content">
            <span className="lp-feature-badge">✦ Image AI</span>
            <h2 className="lp-feature-title">Hyper-Realistic Image<br />Synthesis</h2>
            <p className="lp-feature-desc">
              Generate stunning visuals that match your brand aesthetic in seconds. Our AI understands style, tone, and composition to create professional imagery.
            </p>
            <ul className="lp-feature-checklist">
              <li>Style-aware image generation</li>
              <li>Brand palette integration</li>
              <li>Multiple format exports (1:1, 9:16, 16:9)</li>
            </ul>
          </div>
          <div className="lp-feature-visual">
            <div className="lp-feature-dark-card">
              <img src={MockupImage} alt="Image Synthesis" style={{ width: '90%', borderRadius: '8px', opacity: 0.85 }} />
            </div>
          </div>
        </div>

        {/* Feature 2 — Cinematic AI Video (reversed) */}
        <div className="lp-feature-row reverse">
          <div className="lp-feature-content">
            <span className="lp-feature-badge">✦ Video AI</span>
            <h2 className="lp-feature-title">Cinematic AI Video<br />Generation</h2>
            <p className="lp-feature-desc">
              Transform your carousels into motion. Our pipeline takes your slides and generates short-form video content optimized for Reels, TikTok & LinkedIn.
            </p>
            <ul className="lp-feature-checklist">
              <li>Auto-animated slide transitions</li>
              <li>AI voiceover script generation</li>
              <li>Ready for Instagram & TikTok</li>
            </ul>
          </div>
          <div className="lp-feature-visual">
            <div className="lp-feature-dark-card">
              <button className="lp-play-button">
                <Play size={22} fill="currentColor" />
              </button>
            </div>
          </div>
        </div>

        {/* Feature 3 — Code Intelligence */}
        <div className="lp-feature-row">
          <div className="lp-feature-content">
            <span className="lp-feature-badge">✦ Smart AI</span>
            <h2 className="lp-feature-title">Context-Aware Code<br />Intelligence</h2>
            <p className="lp-feature-desc">
              ContentLab understands your industry and integrates your brand patterns so that every generation feels uniquely yours.
            </p>
            <ul className="lp-feature-checklist">
              <li>Brand voice memory</li>
              <li>Multi-language content support</li>
              <li>Auto-formatting (Text, JSON)</li>
            </ul>
          </div>
          <div className="lp-feature-visual">
            <div className="lp-feature-dark-card">
              <div className="lp-code-preview">
                <div className="lp-code-line"><span className="lp-code-comment">// ContentLab AI Engine</span></div>
                <div className="lp-code-line"><span className="lp-code-keyword">const</span> carousel = <span className="lp-code-keyword">await</span> generate({`{`}</div>
                <div className="lp-code-line">  topic: <span className="lp-code-string">"Marketing Digital"</span>,</div>
                <div className="lp-code-line">  slides: <span className="lp-code-string">7</span>,</div>
                <div className="lp-code-line">  style: <span className="lp-code-string">"brand"</span>,</div>
                <div className="lp-code-line">{`}`});</div>
                <div className="lp-code-line"></div>
                <div className="lp-code-line"><span className="lp-code-comment">// → 7 slides ready in 3s ✓</span></div>
                <div className="lp-code-line"><span className="lp-code-keyword">export</span>(carousel, <span className="lp-code-string">"google-slides"</span>);</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── PRICING ── */}
      <section className="lp-pricing" id="pricing">
        <h2 className="lp-section-title">Choose Your Path</h2>
        <p className="lp-pricing-sub">ContentLab se adapta a tu ritmo. Comenzá gratis y escala cuando lo necesites.</p>

        <div className="lp-pricing-grid">
          {/* Free */}
          <div className="lp-plan-card">
            <div className="lp-plan-name">Yours</div>
            <div className="lp-plan-price">$0</div>
            <div className="lp-plan-period">Para siempre gratis</div>
            <ul className="lp-plan-features">
              <li>5 generaciones / mes</li>
              <li>Carruseles IA básicos</li>
              <li>Google Slides Sync</li>
              <li>Exportar en 1:1</li>
            </ul>
            <Link to="/register" className="lp-plan-cta-free">Get Started</Link>
          </div>

          {/* Pro */}
          <div className="lp-plan-card featured">
            <div className="lp-plan-badge">Popular</div>
            <div className="lp-plan-name">From</div>
            <div className="lp-plan-price">$40</div>
            <div className="lp-plan-period">por mes, facturado mensual</div>
            <ul className="lp-plan-features">
              <li>Generaciones ilimitadas</li>
              <li>Imagen IA de alto detalle</li>
              <li>Todos los formatos (1:1, 9:16, 16:9)</li>
              <li>Soporte prioritario</li>
              <li>Historial completo de contenido</li>
            </ul>
            <Link to="/register" className="lp-plan-cta-paid">Launch Your Idea</Link>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <div className="lp-cta-banner">
        <h2 className="lp-cta-title">Ready to start fresh with AI?</h2>
        <p className="lp-cta-sub">
          Con ContentLab transformás tus ideas en contenido de impacto en cuestión de segundos.
        </p>
        <Link to="/register" className="btn-lp-primary">
          Get Started Now
        </Link>
      </div>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-logo">ContentLab</div>
        <div className="lp-footer-links">
          <a href="#">Privacidad</a>
          <a href="#">Términos</a>
          <a href="#">Soporte</a>
          <a href="#">Blog</a>
        </div>
      </footer>

    </div>
  );
};

export default Landing;
