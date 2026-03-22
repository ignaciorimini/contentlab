import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Search,
  Star,
  Download,
  ExternalLink,
  Filter,
  FileText,
  BarChart2,
  Calendar,
  Mail,
  Instagram,
  Youtube,
  Linkedin,
  Globe,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import './Marketplace.css';

interface Template {
  id: number;
  title: string;
  description: string;
  category: string;
  author: string;
  authorAvatar: string;
  rating: number;
  downloads: number;
  driveUrl: string;
  icon: React.ReactNode;
  tags: string[];
  featured?: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: 1,
    title: 'Content Calendar 2024',
    description: 'Plan and schedule your content across all platforms with this comprehensive monthly calendar. Includes status tracking, platform columns, and analytics.',
    category: 'Planning',
    author: 'Nacho Rimini',
    authorAvatar: 'https://i.pravatar.cc/100?img=3',
    rating: 4.9,
    downloads: 1240,
    driveUrl: 'https://docs.google.com/spreadsheets',
    icon: <Calendar size={22} />,
    tags: ['calendario', 'planning', 'social media'],
    featured: true,
  },
  {
    id: 2,
    title: 'Social Media Audit',
    description: 'Analiza el rendimiento de tus perfiles sociales. Métricas clave, benchmarks y recomendaciones de mejora en una sola hoja.',
    category: 'Analytics',
    author: 'ContentLab Team',
    authorAvatar: 'https://i.pravatar.cc/100?img=12',
    rating: 4.7,
    downloads: 893,
    driveUrl: 'https://docs.google.com/spreadsheets',
    icon: <BarChart2 size={22} />,
    tags: ['analytics', 'audit', 'kpi'],
    featured: true,
  },
  {
    id: 3,
    title: 'Instagram Content Planner',
    description: 'Planifica tu feed de Instagram con preview visual, copywriting por post, hashtags sugeridos y horarios óptimos de publicación.',
    category: 'Instagram',
    author: 'María G.',
    authorAvatar: 'https://i.pravatar.cc/100?img=5',
    rating: 4.8,
    downloads: 2105,
    driveUrl: 'https://docs.google.com/spreadsheets',
    icon: <Instagram size={22} />,
    tags: ['instagram', 'feed', 'hashtag'],
  },
  {
    id: 4,
    title: 'YouTube Script Template',
    description: 'Estructura completa para guiones de YouTube: hook, desarrollo, CTA y notas de edición. Compatible con shorts y videos largos.',
    category: 'YouTube',
    author: 'Lucas P.',
    authorAvatar: 'https://i.pravatar.cc/100?img=8',
    rating: 4.6,
    downloads: 1560,
    driveUrl: 'https://docs.google.com/document',
    icon: <Youtube size={22} />,
    tags: ['youtube', 'guion', 'script'],
  },
  {
    id: 5,
    title: 'Email Marketing Campaign',
    description: 'Template de campaña de email marketing con seguimiento de opens, clicks y conversiones. Incluye A/B test tracking.',
    category: 'Email',
    author: 'Sol M.',
    authorAvatar: 'https://i.pravatar.cc/100?img=9',
    rating: 4.5,
    downloads: 720,
    driveUrl: 'https://docs.google.com/spreadsheets',
    icon: <Mail size={22} />,
    tags: ['email', 'newsletter', 'campaña'],
  },
  {
    id: 6,
    title: 'LinkedIn Content Strategy',
    description: 'Framework de contenido para LinkedIn: tipos de posts, frecuencia, storytelling y métricas de engagement profesional.',
    category: 'LinkedIn',
    author: 'Pablo R.',
    authorAvatar: 'https://i.pravatar.cc/100?img=15',
    rating: 4.7,
    downloads: 980,
    driveUrl: 'https://docs.google.com/document',
    icon: <Linkedin size={22} />,
    tags: ['linkedin', 'b2b', 'personal brand'],
  },
  {
    id: 7,
    title: 'Blog Editorial Calendar',
    description: 'Organiza tu estrategia de blog con keywords, fechas de publicación, autores y estados de redacción en una vista clara.',
    category: 'Blog',
    author: 'Agus F.',
    authorAvatar: 'https://i.pravatar.cc/100?img=20',
    rating: 4.4,
    downloads: 640,
    driveUrl: 'https://docs.google.com/spreadsheets',
    icon: <FileText size={22} />,
    tags: ['blog', 'seo', 'editorial'],
  },
  {
    id: 8,
    title: 'Growth Metrics Dashboard',
    description: 'Dashboard mensual para tracking de KPIs de crecimiento: seguidores, alcance, engagement y conversiones por canal.',
    category: 'Analytics',
    author: 'Nacho Rimini',
    authorAvatar: 'https://i.pravatar.cc/100?img=3',
    rating: 4.9,
    downloads: 1830,
    driveUrl: 'https://docs.google.com/spreadsheets',
    icon: <TrendingUp size={22} />,
    tags: ['kpi', 'crecimiento', 'dashboard'],
    featured: true,
  },
  {
    id: 9,
    title: 'Website Content Map',
    description: 'Mapea toda la arquitectura de contenido de tu sitio web: páginas, copys, CTAs y responsables por sección.',
    category: 'Web',
    author: 'Rami T.',
    authorAvatar: 'https://i.pravatar.cc/100?img=25',
    rating: 4.3,
    downloads: 410,
    driveUrl: 'https://docs.google.com/spreadsheets',
    icon: <Globe size={22} />,
    tags: ['web', 'arquitectura', 'ux writing'],
  },
];

const CATEGORIES = ['Todos', 'Planning', 'Analytics', 'Instagram', 'YouTube', 'Email', 'LinkedIn', 'Blog', 'Web'];

const Marketplace = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [sortBy, setSortBy] = useState('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filtered = TEMPLATES
    .filter(t => {
      const matchesSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = activeCategory === 'Todos' || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return b.downloads - a.downloads;
      if (sortBy === 'rating') return b.rating - a.rating;
      return a.title.localeCompare(b.title);
    });

  const featured = TEMPLATES.filter(t => t.featured).slice(0, 3);

  const handleOpen = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content marketplace-main">
        {/* Header */}
        <div className="marketplace-header">
          <div>
            <h1 className="marketplace-title">Marketplace de Plantillas</h1>
            <p className="marketplace-subtitle">Descubrí y usá plantillas de Google Drive listas para usar</p>
          </div>
        </div>

        {/* Featured */}
        <section className="featured-section">
          <h2 className="section-label">✨ Destacadas</h2>
          <div className="featured-grid">
            {featured.map(t => (
              <div key={t.id} className="featured-card" onClick={() => handleOpen(t.driveUrl)}>
                <div className="featured-card-icon">{t.icon}</div>
                <div className="featured-card-info">
                  <span className="featured-category-badge">{t.category}</span>
                  <h3>{t.title}</h3>
                  <p>{t.description.slice(0, 80)}...</p>
                </div>
                <div className="featured-card-stats">
                  <span><Star size={12} fill="currentColor" /> {t.rating}</span>
                  <span><Download size={12} /> {t.downloads.toLocaleString()}</span>
                </div>
                <div className="featured-card-open">
                  <ExternalLink size={16} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Search & Filters */}
        <div className="marketplace-controls">
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar plantillas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
              id="marketplace-search"
            />
          </div>

          <div className="sort-dropdown">
            <button
              className="sort-btn"
              onClick={() => setShowSortMenu(prev => !prev)}
              id="marketplace-sort-btn"
            >
              <Filter size={14} />
              {sortBy === 'popular' ? 'Más populares' : sortBy === 'rating' ? 'Mejor rating' : 'A-Z'}
              <ChevronDown size={14} />
            </button>
            {showSortMenu && (
              <div className="sort-menu">
                {[
                  { key: 'popular', label: 'Más populares' },
                  { key: 'rating', label: 'Mejor rating' },
                  { key: 'alpha', label: 'A-Z' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    className={`sort-option ${sortBy === opt.key ? 'active' : ''}`}
                    onClick={() => { setSortBy(opt.key); setShowSortMenu(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="categories-bar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              id={`cat-${cat.toLowerCase()}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="templates-grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <FileText size={40} />
              <p>No se encontraron plantillas</p>
              <span>Probá con otro término o categoría</span>
            </div>
          ) : (
            filtered.map(t => (
              <div key={t.id} className="template-card">
                <div className="template-card-top">
                  <div className="template-icon">{t.icon}</div>
                  <span className="template-category">{t.category}</span>
                </div>
                <h3 className="template-title">{t.title}</h3>
                <p className="template-desc">{t.description}</p>
                <div className="template-tags">
                  {t.tags.map(tag => (
                    <span key={tag} className="template-tag">#{tag}</span>
                  ))}
                </div>
                <div className="template-footer">
                  <div className="template-author">
                    <img src={t.authorAvatar} alt={t.author} />
                    <span>{t.author}</span>
                  </div>
                  <div className="template-meta">
                    <span className="meta-stat"><Star size={12} fill="currentColor" /> {t.rating}</span>
                    <span className="meta-stat"><Download size={12} /> {t.downloads.toLocaleString()}</span>
                  </div>
                </div>
                <button
                  className="template-cta"
                  onClick={() => handleOpen(t.driveUrl)}
                  id={`open-template-${t.id}`}
                >
                  <ExternalLink size={14} />
                  Abrir en Drive
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Marketplace;
