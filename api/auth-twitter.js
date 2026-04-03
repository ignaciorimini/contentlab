import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    // Twitter OAuth 2.0 API V2 requires PKCE, providing support for codeVerifier
    const { code, redirectUri, codeVerifier } = request.body;
    const authHeader = request.headers.authorization;

    const clientId = process.env.VITE_TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;

    if (!clientId) {
        return response.status(500).json({ error: 'Falta VITE_TWITTER_CLIENT_ID en las variables de entorno de Vercel' });
    }

    try {
        // 1. Intercambiar Código oauth por el Access Token Oficial HTTP
        const basicAuth = Buffer.from(`${clientId}:${clientSecret || ''}`).toString('base64');

        // Authorization_code flag
        const params = new URLSearchParams({
            code: code,
            grant_type: 'authorization_code',
            client_id: clientId,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier || 'challenge'
        });

        const tokenReq = await fetch(`https://api.twitter.com/2/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`
            },
            body: params.toString()
        });

        const tokenData = await tokenReq.json();

        if (tokenData.error) {
            throw new Error(`${tokenData.error}: ${tokenData.error_description}`);
        }
        const accessToken = tokenData.access_token;

        // 2. Autenticar de manera segura contra la BdD
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.VITE_SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return response.status(401).json({ error: 'No autorizado' });
        }

        // 3. Preguntar los datos demográficos usando API v2 (/me)
        const profileReq = await fetch(`https://api.twitter.com/2/users/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const profileData = await profileReq.json();

        // 4. Guardar permanentemente en Supabase
        const { data, error } = await supabase
            .from('social_accounts')
            .insert({
                user_id: user.id,
                platform: 'twitter',
                account_name: profileData.data?.username ? `@${profileData.data.username}` : 'Cuenta X Oficial',
                access_token: accessToken,
                platform_account_id: profileData.data?.id
            })
            .select()
            .single();

        if (error) throw error;

        return response.status(200).json({ success: true, account: data });
    } catch (err) {
        console.error("Twitter Auth Error:", err);
        return response.status(500).json({ error: err.message });
    }
}
