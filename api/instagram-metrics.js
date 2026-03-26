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

        // 2. Obtener métricas de la cuenta (Insights basicos)
        // Para obtener seguidores en IG requiere permisos específicos, pero podemos pedir datos 
        // del perfil con ?fields=followers_count,media_count
        const igProfileReq = await fetch(`https://graph.facebook.com/v19.0/${accountData.platform_account_id}?fields=followers_count,media_count&access_token=${accountData.access_token}`);
        const profileData = await igProfileReq.json();

        if (profileData.error) {
            throw new Error(`Error de Graph API: ${profileData.error.message}`);
        }

        // 3. Obtener métricas de posts anteriores 
        // Pedimos los posts con likes y comments
        const mediaReq = await fetch(`https://graph.facebook.com/v19.0/${accountData.platform_account_id}/media?fields=like_count,comments_count&limit=50&access_token=${accountData.access_token}`);
        const mediaListData = await mediaReq.json();

        let totalLikes = 0;
        let totalComments = 0;

        if (!mediaListData.error && mediaListData.data) {
            mediaListData.data.forEach(post => {
                totalLikes += post.like_count || 0;
                totalComments += post.comments_count || 0;
            });
        }

        const metrics = {
            followers_count: profileData.followers_count || 0,
            media_count: profileData.media_count || 0,
            total_likes: totalLikes,
            total_comments: totalComments
        };

        return response.status(200).json({ success: true, metrics });

    } catch (err) {
        console.error("Error obteniendo métricas en sociales:", err);
        return response.status(500).json({ error: err.message });
    }
}
