import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import {
    BarChart2,
    Users,
    Heart,
    MessageCircle,
    FileText,
    Activity,
    Globe
} from 'lucide-react';
import './Metrics.css';

interface InstagramPost {
    id: string;
    caption?: string;
    media_url: string;
    thumbnail_url?: string;
    permalink: string;
    media_type: string;
    like_count: number;
    comments_count: number;
    timestamp: string;
}

interface InstagramMetrics {
    followers_count: number;
    media_count: number;
    total_likes: number;
    total_comments: number;
    recent_posts: InstagramPost[];
}

const Metrics = () => {
    const [metrics, setMetrics] = useState<InstagramMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("No hay sesión activa");

                const res = await fetch('/api/instagram-metrics', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Error al obtener métricas");
                }

                setMetrics(data.metrics);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    return (
        <div className="metrics-container">
            <Sidebar />
            <main className="metrics-content">
                <header className="metrics-header">
                    <div className="header-info">
                        <h1><BarChart2 size={28} /> Panel de Métricas</h1>
                        <p className="subtitle">Analiza el rendimiento de tus cuentas sociales conectadas.</p>
                    </div>
                </header>

                {loading ? (
                    <div className="loading-state">
                        <Activity className="spinner" size={40} />
                        <p>Obteniendo métricas en tiempo real...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <Globe size={40} />
                        <h3>No pudimos cargar tus métricas</h3>
                        <p>{error}</p>
                        <button onClick={() => window.location.reload()} className="retry-btn">
                            Reintentar
                        </button>
                    </div>
                ) : (
                    <div className="metrics-dashboard">
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon followers">
                                    <Users size={24} />
                                </div>
                                <div className="stat-details">
                                    <span className="stat-label">Seguidores</span>
                                    <span className="stat-value">{metrics?.followers_count.toLocaleString() || 0}</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon posts">
                                    <FileText size={24} />
                                </div>
                                <div className="stat-details">
                                    <span className="stat-label">Publicaciones Totales</span>
                                    <span className="stat-value">{metrics?.media_count.toLocaleString() || 0}</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon likes">
                                    <Heart size={24} />
                                </div>
                                <div className="stat-details">
                                    <span className="stat-label">Interacciones Totales (Likes)</span>
                                    <span className="stat-value">{metrics?.total_likes.toLocaleString() || 0}</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon comments">
                                    <MessageCircle size={24} />
                                </div>
                                <div className="stat-details">
                                    <span className="stat-label">Comentarios Totales</span>
                                    <span className="stat-value">{metrics?.total_comments.toLocaleString() || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div className="recent-posts-section">
                            <h2 className="section-title">Últimas Publicaciones</h2>
                            {metrics?.recent_posts && metrics.recent_posts.length > 0 ? (
                                <div className="posts-grid">
                                    {metrics.recent_posts.map(post => (
                                        <div key={post.id} className="post-card">
                                            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="post-image-container">
                                                {post.media_type === 'VIDEO' ? (
                                                    <img src={post.thumbnail_url || post.media_url} alt="Video thumbnail" className="post-image" loading="lazy" />
                                                ) : (
                                                    <img src={post.media_url} alt="Post" className="post-image" loading="lazy" />
                                                )}
                                                <div className="post-overlay">
                                                    Ver en Instagram
                                                </div>
                                            </a>
                                            <div className="post-content">
                                                <p className="post-caption">{post.caption ? (post.caption.length > 80 ? post.caption.substring(0, 80) + '...' : post.caption) : 'Sin descripción'}</p>
                                                <div className="post-stats">
                                                    <div className="post-stat">
                                                        <Heart size={16} />
                                                        <span>{post.like_count || 0}</span>
                                                    </div>
                                                    <div className="post-stat">
                                                        <MessageCircle size={16} />
                                                        <span>{post.comments_count || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-posts-text">No hay publicaciones recientes para mostrar.</p>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Metrics;
