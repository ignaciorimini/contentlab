import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  const { code, redirectUri } = request.body;
  const authHeader = request.headers.authorization; // Para identificar al usuario con Supabase

  // Obtenemos los secretos del entorno (Vercel)
  const clientId = process.env.VITE_FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET; // ¡Secreto real! No lleva VITE_

  if (!clientSecret) {
    return response.status(500).json({ error: 'Falta FACEBOOK_CLIENT_SECRET en las variables de entorno de Vercel' });
  }

  try {
    // 1. Intercambiar Código por un Access Token
    const tokenReq = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`);
    const tokenData = await tokenReq.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message);
    }
    const accessToken = tokenData.access_token;

    // 2. Autenticar al usuario en el backend de Supabase
    // Inicializamos Supabase usando el rol de servicio o el token del usuario actual
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } } 
    );
    
    // Validar sesión real
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return response.status(401).json({ error: 'No autorizado' });
    }

    // 3. Obtener el nombre del usuario o de la página desde Facebook
    // Extraemos su perfil en Meta (aquí podríamos traer sus IDs de Instagram reales más adelante)
    const profileReq = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}`);
    const profileData = await profileReq.json();

    // 4. Guardar en Supabase
    const { data, error } = await supabase
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform: 'instagram',
        account_name: profileData.name || 'Cuenta Oficial',
        access_token: accessToken,
        platform_account_id: profileData.id
      })
      .select()
      .single();

    if (error) throw error;

    return response.status(200).json({ success: true, account: data });
  } catch (err) {
    console.error(err);
    return response.status(500).json({ error: err.message });
  }
}
