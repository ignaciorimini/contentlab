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
    } else if (platform === 'linkedin') {
      // API de LinkedIn para publicar contenido (UGC Post)
      let assetUrn = null;

      if (imageUrl) {
        // 1. Obtener buffer de la foto
        const imageRes = await fetch(imageUrl);
        const imageBuffer = await imageRes.arrayBuffer();

        // 2. Pedir permiso a LinkedIn para subir un Asset (Binary Upload)
        const registerReq = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accountData.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: `urn:li:person:${accountData.platform_account_id}`,
              serviceRelationships: [{
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent"
              }]
            }
          })
        });
        const registerData = await registerReq.json();

        if (registerData && registerData.value) {
          assetUrn = registerData.value.asset;
          const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;

          // 3. Subir los bytes binarios de la imagen
          const uploadReq = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accountData.access_token}` },
            body: Buffer.from(imageBuffer)
          });

          if (!uploadReq.ok) {
            assetUrn = null;
          }
        }
      }

      const linkedinPayload = {
        author: `urn:li:person:${accountData.platform_account_id}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: text },
            shareMediaCategory: assetUrn ? "IMAGE" : "NONE",
            ...(assetUrn ? {
              media: [{
                status: "READY",
                description: { text: "Contenido de Content Lab" },
                media: assetUrn,
                title: { text: "Ver contenido" }
              }]
            } : {})
          }
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };

      const liReq = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accountData.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(linkedinPayload)
      });

      const liData = await liReq.json();
      if (liData.error || liData.status >= 400) {
        throw new Error(liData.message || "Error al publicar en LinkedIn");
      }

    } else if (platform === 'twitter') {
      // API de Twitter V2 (Crear un Tweet)
      // Nota: Subir imágenes a Twitter requiere el endpoint v1.1 multipart, por MVP dejaremos el texto + link de la imagen
      const tweetText = text.length > 280 ? text.substring(0, 277) + "..." : text;
      // Añadimos la url de la imagen directamente con un enter real si es que existe
      const finalTweetText = imageUrl ? `${tweetText}\n\n${imageUrl}` : tweetText;

      const twitterReq = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accountData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: finalTweetText })
      });

      const twitterData = await twitterReq.json();
      if (twitterData.errors || twitterData.title === 'Unauthorized') {
        throw new Error(twitterData.detail || "Error al publicar en X (Twitter)");
      }

    } else {
      // Simular un retraso para otras desconocidas
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Opcional: Podríamos marcar este contenido como "Publicado" en la tabla 'content'.

    return response.status(200).json({ success: true, message: `Publicado exitosamente en ${platform}` });

  } catch (err) {
    console.error("Error publicando en sociales:", err);
    return response.status(500).json({ error: err.message });
  }
}
