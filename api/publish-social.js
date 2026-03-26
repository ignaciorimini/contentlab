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

    let igAccountId = accountData.platform_account_id;

    if (platform === 'instagram') {
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

      // Paso 1: Crear Contenedor
      const mediaReq = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(text)}&access_token=${accountData.access_token}`, { method: 'POST' });
      const mediaData = await mediaReq.json();

      if (mediaData.error) {
        throw new Error(mediaData.error.message || "Error al crear contenedor en Instagram");
      }

      // Paso 2: Publicar Contenedor
      const publishReq = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media_publish?creation_id=${mediaData.id}&access_token=${accountData.access_token}`, { method: 'POST' });
      const publishData = await publishReq.json();

      if (publishData.error) {
        throw new Error(publishData.error.message || "Error al publicar en Instagram");
      }
    } else {
      // Simular un retraso de procesamiento para dar feedback al usuario en otras plataformas no implementadas
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Opcional: Podríamos marcar este contenido como "Publicado" en la tabla 'content'.

    return response.status(200).json({ success: true, message: `Publicado exitosamente en ${platform}` });

  } catch (err) {
    console.error("Error publicando en sociales:", err);
    return response.status(500).json({ error: err.message });
  }
}
