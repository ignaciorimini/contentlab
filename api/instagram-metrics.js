import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
        return response.status(401).json({ error: 'No autorizado' });
    }

    try {
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.VITE_SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: authHeader } } }
        );

        // Verificar si el usuario está autenticado
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No autorizado");

        // 1. Obtener token de Instagram
        const { data: accounts, error: accError } = await supabase
            .from('social_accounts')
            .select('access_token, platform_account_id, platform')
            .eq('user_id', user.id)
            .eq('platform', 'instagram');

        if (accError || !accounts || accounts.length === 0) {
            throw new Error("No tienes cuentas de Instagram vinculadas o los permisos necesarios.");
        }

        // Asumiremos la primera cuenta de IG para el panel general, o podríamos iterar
        const accountData = accounts[0];

        // 2. Resolver el ID real de Instagram (el DB guarda FB User ID por defecto)
        let igAccountId = accountData.platform_account_id;

        // Pedimos las páginas que maneja el usuario para encontrar la cuenta de IG Profesional
        const pagesReq = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accountData.access_token}`);
        const pagesData = await pagesReq.json();

        if (!pagesData.error && pagesData.data && pagesData.data.length > 0) {
            for (const page of pagesData.data) {
                const igReq = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${accountData.access_token}`);
                const igData = await igReq.json();
                if (igData && igData.instagram_business_account) {
                    igAccountId = igData.instagram_business_account.id;
                    break;
                }
            }
        }

        if (igAccountId === accountData.platform_account_id) {
            throw new Error("No se encontró una cuenta de Instagram Profesional vinculada a tus páginas de Facebook. Asegúrate de tenerla conectada.");
        }

        // 3. Obtener métricas de la cuenta de IG
        const igProfileReq = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}?fields=followers_count,media_count&access_token=${accountData.access_token}`);
        const profileData = await igProfileReq.json();

        if (profileData.error) {
            throw new Error(`${profileData.error.message}`);
        }

        // 4. Obtener métricas de posts anteriores usando el ID correcto
        const mediaReq = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media?fields=like_count,comments_count,media_url,caption,permalink,thumbnail_url,media_type,timestamp&limit=50&access_token=${accountData.access_token}`);
        const mediaListData = await mediaReq.json();

        let totalLikes = 0;
        let totalComments = 0;
        let recentPosts = [];

        if (!mediaListData.error && mediaListData.data) {
            mediaListData.data.forEach(post => {
                totalLikes += post.like_count || 0;
                totalComments += post.comments_count || 0;
            });
            recentPosts = mediaListData.data.slice(0, 12);
        }

        const metrics = {
            followers_count: profileData.followers_count || 0,
            media_count: profileData.media_count || 0,
            total_likes: totalLikes,
            total_comments: totalComments,
            recent_posts: recentPosts
        };

        return response.status(200).json({ success: true, metrics });

    } catch (err) {
        console.error("Error obteniendo métricas en sociales:", err);
        return response.status(500).json({ error: err.message });
    }
}
