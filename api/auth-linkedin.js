import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    const { code, redirectUri } = request.body;
    const authHeader = request.headers.authorization;

    const clientId = process.env.VITE_LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientSecret) {
        return response.status(500).json({ error: 'Falta LINKEDIN_CLIENT_SECRET en las variables de entorno de Vercel' });
    }

    try {
        // 1. Intercambiar Código por un Access Token
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret
        });

        const tokenReq = await fetch(`https://www.linkedin.com/oauth/v2/accessToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const tokenData = await tokenReq.json();

        if (tokenData.error) {
            throw new Error(`${tokenData.error}: ${tokenData.error_description}`);
        }
        const accessToken = tokenData.access_token;

        // 2. Autenticar al usuario en el backend de Supabase
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.VITE_SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return response.status(401).json({ error: 'No autorizado' });
        }

        // 3. Obtener el nombre del usuario desde LinkedIn (OpenID API)
        const profileReq = await fetch(`https://api.linkedin.com/v2/userinfo`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const profileData = await profileReq.json();

        // 4. Guardar en Supabase
        const { data, error } = await supabase
            .from('social_accounts')
            .insert({
                user_id: user.id,
                platform: 'linkedin',
                account_name: profileData.name || profileData.given_name || 'Cuenta Oficial LinkedIn',
                access_token: accessToken,
                platform_account_id: profileData.sub || profileData.id
            })
            .select()
            .single();

        if (error) throw error;

        return response.status(200).json({ success: true, account: data });
    } catch (err) {
        console.error("LinkedIn Auth Error:", err);
        return response.status(500).json({ error: err.message });
    }
}
