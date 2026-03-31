import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) return response.status(401).json({ error: 'No autorizado' });

    const { limit = '10', after = '' } = request.query;

    try {
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.VITE_SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("No autorizado");

        const { data: accounts, error: accError } = await supabase
            .from('social_accounts')
            .select('access_token, platform_account_id, platform')
            .eq('user_id', user.id)
            .eq('platform', 'instagram');

        if (accError || !accounts || accounts.length === 0) {
            throw new Error("No tienes cuentas de Instagram vinculadas.");
        }

        const accountData = accounts[0];
        let igAccountId = accountData.platform_account_id;

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
            throw new Error("No se encontró cuenta de Instagram Profesional.");
        }

        // Fetch paginated media
        let url = `https://graph.facebook.com/v19.0/${igAccountId}/media?fields=like_count,comments_count,media_url,caption,permalink,thumbnail_url,media_type,timestamp&limit=${limit}&access_token=${accountData.access_token}`;
        if (after) {
            url += `&after=${after}`;
        }

        const mediaReq = await fetch(url);
        const mediaListData = await mediaReq.json();

        if (mediaListData.error) throw new Error(mediaListData.error.message);

        // Fetch insights for each post
        const postsWithInsights = await Promise.all(
            mediaListData.data.map(async (post) => {
                let metrics = '';
                if (post.media_type === 'VIDEO') {
                    // Para reels
                    metrics = 'plays,saved,shares';
                } else if (post.media_type === 'IMAGE' || post.media_type === 'CAROUSEL_ALBUM') {
                    metrics = 'saved'; 
                }

                let insightsData = { saved: 0, shares: 0, plays: 0 };
                
                if (metrics) {
                    try {
                        const insightsReq = await fetch(`https://graph.facebook.com/v19.0/${post.id}/insights?metric=${metrics}&access_token=${accountData.access_token}`);
                        const insightsRes = await insightsReq.json();
                        
                        if (!insightsRes.error && insightsRes.data) {
                            insightsRes.data.forEach(item => {
                                if (item.name === 'saved') insightsData.saved = item.values[0].value;
                                if (item.name === 'shares') insightsData.shares = item.values[0].value;
                                if (item.name === 'plays') insightsData.plays = item.values[0].value;
                            });
                        }
                    } catch (e) {
                         console.warn(`Failed fetching insights for ${post.id}`, e);
                    }
                }

                return {
                    ...post,
                    advanced_metrics: insightsData
                };
            })
        );

        return response.status(200).json({ 
            success: true, 
            data: postsWithInsights,
            paging: mediaListData.paging || null
        });

    } catch (err) {
        console.error("Error paginating history:", err);
        return response.status(500).json({ error: err.message });
    }
}
