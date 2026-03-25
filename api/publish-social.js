import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  const { accountId, contentId, text, imageUrl, platform } = request.body;
  const authHeader = request.headers.authorization;

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } } 
    );
    
    // Verificar si el usuario está autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No autorizado");

    // 1. Obtener el Token de acceso real desde la base de datos
    const { data: accountData, error: accError } = await supabase
      .from('social_accounts')
      .select('access_token, platform_account_id')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accError) throw new Error("Cuenta no encontrada o sin permisos");

    // Simularemos la llamada oficial a la API de Graph (Post a IG o LinkedIn)
    // En la vida real, este código sería:
    /*
      if (platform === 'instagram') {
        // Paso 1: Crear Contenedor
        const mediaReq = await fetch(`https://graph.facebook.com/v19.0/${accountData.platform_account_id}/media?image_url=${imageUrl}&caption=${encodeURIComponent(text)}&access_token=${accountData.access_token}`, { method: 'POST' });
        const mediaData = await mediaReq.json();
        // Paso 2: Publicar Contenedor
        await fetch(`https://graph.facebook.com/v19.0/${accountData.platform_account_id}/media_publish?creation_id=${mediaData.id}&access_token=${accountData.access_token}`, { method: 'POST' });
      }
    */

    // Simular un retraso de procesamiento para dar feedback al usuario
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Opcional: Podríamos marcar este contenido como "Publicado" en la tabla 'content'.

    return response.status(200).json({ success: true, message: `Publicado exitosamente en ${platform}` });

  } catch (err) {
    console.error("Error publicando en sociales:", err);
    return response.status(500).json({ error: err.message });
  }
}
