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
    Globe,
    Bookmark,
    Share2,
    Play
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
    advanced_metrics?: {
        saved: number;
        shares: number;
        plays: number;
    }
}

interface InstagramMetrics {
    followers_count: number;
    media_count: number;
    total_likes: number;
    total_comments: number;
}

const Metrics = () => {
    const [metrics, setMetrics] = useState<InstagramMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // History Pagination State
    const [posts, setPosts] = useState<InstagramPost[]>([]);
    const [afterCursor, setAfterCursor] = useState<string | null>(null);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [postsError, setPostsError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("No hay sesión activa");

                // Fetch Top-Level Metrics
                const res = await fetch('/api/instagram-metrics', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error al obtener métricas");

                setMetrics(data.metrics);
                
                // Start fetching history
                fetchHistory(session.access_token);

            } catch (err: any) {
                setError(err.message);
                setLoading(false);
                setLoadingPosts(false);
            }
        };

        fetchDashboardData();
    }, []);

    const fetchHistory = async (token: string, cursor?: string | null) => {
        try {
            if (cursor) setLoadingMore(true);
            else setLoadingPosts(true);
            setPostsError(null);

            const url = `/api/instagram-history?limit=10${cursor ? `&after=${cursor}` : ''}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Error al obtener historial");

            if (cursor) {
                setPosts(prev => [...prev, ...data.data]);
            } else {
                setPosts(data.data);
            }
            
            if (data.paging && data.paging.cursors && data.paging.cursors.after) {
               setAfterCursor(data.paging.cursors.after);
               // If there is no next page, data.paging.next will be missing
               if (!data.paging.next) setAfterCursor(null);
            } else {
               setAfterCursor(null);
            }

        } catch (err: any) {
            setPostsError(err.message);
        } finally {
            setLoadingPosts(false);
            setLoadingMore(false);
            setLoading(false); 
        }
    };

    const handleLoadMore = async () => {
        if (!afterCursor) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            fetchHistory(session.access_token, afterCursor);
        }
    };

    return (
        <div className="metrics-container">
            <Sidebar />
            <main className="metrics-content">
                <header className="metrics-header">
                    <div className="header-info">
                        <h1><BarChart2 size={28} /> Panel de Métricas</h1>
                        <p className="subtitle">Analiza el rendimiento de tu contenido y extrae métricas avanzadas (Views, Saves, Shares).</p>
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
                                    <span className="stat-label">Acumulado General (Likes)</span>
                                    <span className="stat-value">{metrics?.total_likes.toLocaleString() || 0}</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon comments">
                                    <MessageCircle size={24} />
                                </div>
                                <div className="stat-details">
                                    <span className="stat-label">Acumulado General (Comments)</span>
                                    <span className="stat-value">{metrics?.total_comments.toLocaleString() || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div className="recent-posts-section">
                            <div className="section-header">
                                <h2 className="section-title">Historial Completo</h2>
                                <p className="section-subtitle">Visualizaciones, guardados, compartidos y más métricas de tus publicaciones.</p>
                            </div>
                            
                            {loadingPosts ? (
                                <div className="loading-state" style={{ height: '30vh' }}>
                                    <Activity className="spinner" size={30} />
                                    <p>Cargando historial de Instagram...</p>
                                </div>
                            ) : postsError ? (
                                <div className="error-state" style={{ height: 'auto', padding: '2rem' }}>
                                    <p>{postsError}</p>
                                    <button onClick={() => window.location.reload()} className="retry-btn">Reintentar</button>
                                </div>
                            ) : posts.length > 0 ? (
                                <>
                                    <div className="posts-grid">
                                        {posts.map(post => (
                                            <div key={post.id} className="post-card">
                                                <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="post-image-container">
                                                    {post.media_type === 'VIDEO' ? (
                                                        <img src={post.thumbnail_url || post.media_url} alt="Video thumbnail" className="post-image" loading="lazy" />
                                                    ) : (
                                                        <img src={post.media_url} alt="Post" className="post-image" loading="lazy" />
                                                    )}
                                                    <div className="post-overlay">
                                                        Ver original en Instagram
                                                    </div>
                                                </a>
                                                <div className="post-content">
                                                    <p className="post-caption">{post.caption ? (post.caption.length > 60 ? post.caption.substring(0, 60) + '...' : post.caption) : 'Sin descripción'}</p>
                                                    <div className="post-stats-grid">
                                                        {post.media_type === 'VIDEO' && post.advanced_metrics && (
                                                            <div className="post-stat insight-play" title="Reproducciones (Views)">
                                                                <Play size={14} /> <span>{post.advanced_metrics.plays || 0}</span>
                                                            </div>
                                                        )}
                                                        <div className="post-stat insight-like" title="Me gusta">
                                                            <Heart size={14} /> <span>{post.like_count || 0}</span>
                                                        </div>
                                                        <div className="post-stat insight-comment" title="Comentarios">
                                                            <MessageCircle size={14} /> <span>{post.comments_count || 0}</span>
                                                        </div>
                                                        <div className="post-stat insight-save" title="Guardados">
                                                            <Bookmark size={14} /> <span>{post.advanced_metrics?.saved || 0}</span>
                                                        </div>
                                                        {post.media_type === 'VIDEO' && post.advanced_metrics && (
                                                            <div className="post-stat insight-share" title="Compartidos">
                                                                <Share2 size={14} /> <span>{post.advanced_metrics.shares || 0}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {afterCursor && (
                                        <div className="load-more-container">
                                            <button 
                                                className="btn-load-more" 
                                                onClick={handleLoadMore}
                                                disabled={loadingMore}
                                            >
                                                {loadingMore ? 'Cargando...' : 'Cargar más antiguas'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="no-posts-text">No tienes publicaciones en tu historial.</p>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Metrics;
