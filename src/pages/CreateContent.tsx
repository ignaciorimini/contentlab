import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Zap,
  Image as ImageIcon,
  Loader2,
  Copy,
  CheckCircle2,
  Share2,
  Layout,
  Layers,
  Sparkles,
  Plus,
  Upload,
  X,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from "@google/generative-ai";
import './CreateContent.css';

const CreateContent = () => {
  const [activeTab, setActiveTab] = useState('simple'); // 'simple' | 'carousel'
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<{ text: string, imageUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [numSlides, setNumSlides] = useState(5);
  const [carouselData, setCarouselData] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [refImage, setRefImage] = useState<string | null>(null); // Base64 of referenced image
  const [aspectRatio, setAspectRatio] = useState('1:1'); // '1:1' | '16:9' | '9:16'
  const [carouselMode, setCarouselMode] = useState('ia'); // 'ia' | 'slides'
  const [googleSlides, setGoogleSlides] = useState<any[]>([]);
  const [isLoadingSlides, setIsLoadingSlides] = useState(false);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [duplicatedSlideUrl, setDuplicatedSlideUrl] = useState<string | null>(null);
  const [slidePlaceholders, setSlidePlaceholders] = useState<string[]>([]); // Placeholders detected from the selected template

  const getGoogleToken = async (): Promise<string> => {
    // 1. Try active session token first
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token) return session.provider_token;

    // 2. Fall back to DB-stored token
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('google_access_token')
        .eq('user_id', user.id)
        .maybeSingle();
      if (settings?.google_access_token) return settings.google_access_token;
    }

    throw new Error("No se encontró token de Google. Por favor, ve a Configuración y vincula tu cuenta de nuevo.");
  };

  const fetchGoogleSlides = async () => {
    setIsLoadingSlides(true);
    setError(null);
    try {
      const token = await getGoogleToken();

      const res = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType=\'application/vnd.google-apps.presentation\'&fields=files(id, name, thumbnailLink)', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Error al obtener presentaciones de Google Drive. Asegúrate de haber iniciado sesión con Google.");
      const data = await res.json();
      setGoogleSlides(data.files || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingSlides(false);
    }
  };

  const processGoogleSlides = async (slideId: string) => {
    setIsGenerating(true);
    setError(null);
    setDuplicatedSlideUrl(null);
    try {
      const token = await getGoogleToken();

      // 1. Duplicate Template
      const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${slideId}/copy`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Generated: ${prompt.slice(0, 20)}...` })
      });
      if (!copyRes.ok) throw new Error("No se pudo duplicar la plantilla.");
      const copyData = await copyRes.json();
      const newId = copyData.id;

      // 2. Get Presentation to scan for placeholders
      const presRes = await fetch(`https://slides.googleapis.com/v1/presentations/${newId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const pres = await presRes.json();

      const placeholders = new Set<string>();

      pres.slides.forEach((slide: any) => {
        slide.pageElements.forEach((el: any) => {
          if (el.shape?.text?.textElements) {
            // Concatenate ALL textRun contents in this shape so placeholders
            // that span multiple lines or multiple runs are detected correctly.
            const shapeText = el.shape.text.textElements
              .map((te: any) => te.textRun?.content ?? '')
              .join('');

            // [\s\S]*? matches any character INCLUDING newlines
            const matches = shapeText.matchAll(/{{[\s\S]*?}}/g);
            for (const match of matches) {
              placeholders.add(match[0]);
            }
          }
        });
      });

      if (placeholders.size === 0) throw new Error("No se encontraron variables {{...}} en la presentación.");

      const placeholderList = Array.from(placeholders);
      // Store detected placeholders for the Dynamic Output preview
      setSlidePlaceholders(placeholderList);

      // 3. Ask Gemini to fill placeholders
      const { data: settings } = await supabase.from('user_settings').select('gemini_api_key').single();
      if (!settings?.gemini_api_key) throw new Error("Configura tu API Key de Gemini.");

      const genAI = new GoogleGenerativeAI(settings.gemini_api_key);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Build a rich Gemini prompt that uses the placeholder name itself as a content/length instruction.
      // e.g. {{PASO 1: titulo breve}} → Gemini understands it's a short step title.
      // e.g. {{cuerpo aquí van 3 oraciones explicando el concepto}} → Gemini matches that length.
      const placeholderDescriptions = placeholderList.map(p => {
        // Normalize newlines for display and for the Gemini key
        const inner = p.replace(/^\{\{|\}\}$/g, '').replace(/\n/g, ' ').trim();
        const displayKey = p.replace(/\n/g, ' ↵ '); // show newlines as ↵ in the prompt
        return `  • "${displayKey}" → el nombre/descripción "${inner}" indica el propósito, jerarquía y extensión esperada del contenido`;
      }).join('\n');

      const geminiPrompt = `
Tengo una plantilla de presentación sobre el tema: "${prompt}".
Contiene los siguientes campos (cada nombre de campo es una instrucción implícita de qué generar):
${placeholderDescriptions}

Reglas ESTRICTAS:
- Usá el nombre del campo como guía de estructura y extensión:
  • Si dice "titulo" o "encabezado" → texto muy corto (3-8 palabras)
  • Si dice "paso" o "paso N" → titulá como tal (ej: "Paso 1: ...")
  • Si dice "cuerpo", "descripcion" o tiene un ejemplo largo → generá contenido de extensión similar
  • Si dice "conclusion" → cierre breve y motivador
- Mantené coherencia y flujo narrativo entre todos los campos
- Generá contenido en español

Devolvé SOLO un JSON válido, sin texto extra ni bloques de código.
Usá como clave el contenido interno del placeholder (sin las llaves {{ }}) pero con los saltos de línea reemplazados por espacio:
{
  "campo1 campo2": "contenido generado",
  ...
}

NOTA: si el nombre del campo tiene saltos de línea, escribilos como un espacio en la clave del JSON.
      `;

      const geminiRes = await model.generateContent(geminiPrompt);
      const geminiText = geminiRes.response.text();
      const cleanJson = geminiText.replace(/```json|```/g, '').trim();
      const values = JSON.parse(cleanJson);

      // 4. Batch Update Presentation
      // Gemini returns { "inner content (normalized, no braces)": "generated text" }
      // We need to find the original placeholder (possibly multi-line) and replace it.
      // Strategy: build a lookup map from normalized key → original full placeholder string
      const normalizedToOriginal = new Map<string, string>();
      for (const original of placeholderList) {
        // Strip {{ }} and normalize newlines to space — this is what Gemini returns as key
        const normalized = original.replace(/^\{\{|\}\}$/g, '').replace(/\n/g, ' ').trim();
        normalizedToOriginal.set(normalized.toLowerCase(), original);
      }

      const requests: any[] = [];
      Object.entries(values).forEach(([geminiKey, text]) => {
        const normalizedKey = geminiKey.replace(/^\{\{|\}\}$/g, '').replace(/\n/g, ' ').trim();
        // Find the original placeholder from the map (case-insensitive)
        const original = normalizedToOriginal.get(normalizedKey.toLowerCase());

        if (original) {
          // Primary: search for the exact original string (handles single-line perfectly)
          requests.push({
            replaceAllText: {
              replaceText: text as string,
              containsText: { text: original, matchCase: false }
            }
          });
          // Fallback: if the placeholder was multi-line, also try the normalized version
          // (some Slides API implementations can match the normalized form)
          if (original.includes('\n')) {
            const normalizedOriginal = original.replace(/\n/g, ' ');
            requests.push({
              replaceAllText: {
                replaceText: text as string,
                containsText: { text: normalizedOriginal, matchCase: false }
              }
            });
          }
        } else {
          // Gemini returned a key we don't recognize as a known placeholder — skip to avoid wrong replacements
          console.warn(`Gemini returned unexpected key: "${geminiKey}" — skipping replacement`);
        }
      });

      const updateRes = await fetch(`https://slides.googleapis.com/v1/presentations/${newId}:batchUpdate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests })
      });

      if (!updateRes.ok) throw new Error("Error actualizando placeholders.");

      // 5. Fetch Thumbnails
      const finalSlides = [];
      for (const slide of pres.slides) {
        const thumbRes = await fetch(`https://slides.googleapis.com/v1/presentations/${newId}/pages/${slide.objectId}/thumbnail`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const thumbData = await thumbRes.json();
        finalSlides.push({
          text: `Slide: ${slide.objectId}`,
          imageUrl: thumbData.contentUrl
        });
      }

      setCarouselData(finalSlides);
      setDuplicatedSlideUrl(`https://docs.google.com/presentation/d/${newId}/edit`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedPost && carouselData.length === 0) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");

      const isCarousel = activeTab === 'carousel';

      const { error } = await supabase
        .from('content')
        .insert({
          user_id: user.id,
          title: prompt.slice(0, 30) + (prompt.length > 30 ? '...' : ''),
          description: isCarousel ? JSON.stringify(carouselData) : generatedPost?.text,
          content_type: isCarousel ? 'CAROUSEL' : 'SOCIAL',
          image_url: isCarousel ? carouselData[0].imageUrl : generatedPost?.imageUrl,
          prompt: prompt,
        });

      if (error) throw error;
      alert("¡Contenido guardado exitosamente!");
    } catch (err: any) {
      console.error("Error saving content:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setGeneratedPost(null);
    setCarouselData([]); // Clear carousel data on new generation
    setCurrentSlide(0); // Reset slide counter
    setCopied(false);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");

      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!settings?.gemini_api_key) {
        throw new Error("Por favor configura tu Gemini API Key en Configuración. (Recuerda guardar los cambios)");
      }

      const genAI = new GoogleGenerativeAI(settings.gemini_api_key);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      if (activeTab === 'carousel' && carouselMode === 'slides') {
        if (!selectedSlideId) throw new Error("Por favor selecciona una presentación de Google Slides.");
        setIsGenerating(false); // Reset generating state to let processGoogleSlides handle it
        await processGoogleSlides(selectedSlideId);
        return;
      }

      if (activeTab === 'carousel') {
        const carouselPrompt = `
          Genera un carrusel de ${numSlides} slides basado en: "${prompt}".
          ${refImage ? "Como referencia, usa la imagen adjunta para inspirar el estilo visual y el tono del contenido." : ""}
          Retorna un JSON con este formato EXACTO: 
          {
            "style_guide": "una descripción corta del estilo visual (ej: flat vector, cyberpunk purple, minimalist 3d)",
            "slides": [
              { "text": "texto corto del slide", "image_prompt": "descripción de la imagen para este slide" }
            ]
          }
        `;

        const parts: any[] = [{ text: carouselPrompt }];
        if (refImage) {
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data: refImage.split(',')[1]
            }
          });
        }

        const result = await model.generateContent(parts);
        const textResponse = result.response.text();
        const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanText);
        const style = data.style_guide;

        const finalSlides = [];
        for (const slide of data.slides) {
          if (!settings.nano_banana_api_key) {
            throw new Error("Por favor configura tu Nano Banana API Key (Google API Key) en Configuración.");
          }
          const imgRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${settings.nano_banana_api_key}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `FORMATO ${aspectRatio === '9:16' ? 'VERTICAL 9:16' : aspectRatio === '16:9' ? 'HORIZONTAL 16:9' : 'CUADRADO 1:1'}. ${slide.image_prompt}. Estilo: ${style}. High quality digital art.` }] }],
              generationConfig: {
                responseModalities: ["IMAGE"]
              }
            })
          });
          if (!imgRes.ok) {
            const errorData = await imgRes.json();
            throw new Error(errorData.error?.message || "Error al llamar a Google AI Studio para imagen de carrusel");
          }
          const imgData = await imgRes.json();
          const base64 = imgData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          finalSlides.push({
            text: slide.text,
            imageUrl: base64 ? `data:image/png;base64,${base64}` : "https://via.placeholder.com/1080"
          });
        }
        setCarouselData(finalSlides);
        // setGeneratedPost({ text: "Carrusel generado exitosamente", imageUrl: finalSlides[0].imageUrl }); // No longer needed as renderResult handles carousel directly
      } else {
        // 1. Generate Text and Image Prompt with Gemini
        const promptContext = `
          Basado en el siguiente tema: "${prompt}", genera dos cosas:
          1. Un posteo para redes sociales (texto).
          2. Una descripción visual muy corta y en inglés perfecta para un generador de imágenes (solo la descripción).
          
          Devuelve el resultado en este formato exacto:
          TEXTO: [aquí el texto del post]
          IMAGE_PROMPT: [aquí la descripción visual]
        `;

        const result = await model.generateContent(promptContext);
        const output = result.response.text();

        const responseText = output.split('IMAGE_PROMPT:')[0].replace('TEXTO:', '').trim();
        const visualPrompt = output.split('IMAGE_PROMPT:')[1]?.trim() || "modern professional digital art";

        // 2. Generate Image with Nano Banana 2 (Google AI Studio API Call)
        let imageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

        if (!settings.nano_banana_api_key) {
          throw new Error("Por favor configura tu Nano Banana API Key (Google API Key) en Configuración.");
        }

        try {
          // El endpoint real de Google AI Studio para "Nano Banana 2" (Gemini 1.5 Flash Image Preview)
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${settings.nano_banana_api_key}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `FORMATO ${aspectRatio === '9:16' ? 'VERTICAL 9:16' : aspectRatio === '16:9' ? 'HORIZONTAL 16:9' : 'CUADRADO 1:1'}. Generate a high-quality, professional social media image for this post: ${visualPrompt}. Cyberpunk nebula style, premium digital art.` }]
              }],
              generationConfig: {
                responseModalities: ["IMAGE"]
              }
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error al llamar a Google AI Studio");
          }

          const data = await response.json();

          // Extraer la imagen en Base64
          const imageDataByte = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          const mimeType = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "image/png";

          if (imageDataByte) {
            imageUrl = `data:${mimeType};base64,${imageDataByte}`;
          } else {
            console.warn("No se recibió la data de imagen, usando fallback.");
          }

        } catch (imgErr: any) {
          console.error("Image gen error:", imgErr);
          throw new Error(`Error en Nano Banana 2 (Google AI Studio): ${imgErr.message}`);
        }

        setGeneratedPost({
          text: responseText,
          imageUrl: imageUrl
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedPost) {
      navigator.clipboard.writeText(generatedPost.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderResult = () => {
    if (isGenerating) {
      return (
        <div className="loading-state">
          <div className="loading-skeleton image-skeleton"></div>
          <div className="loading-skeleton text-skeleton" style={{ width: '90%' }}></div>
          <div className="loading-skeleton text-skeleton" style={{ width: '70%' }}></div>
          <div className="loading-skeleton text-skeleton" style={{ width: '80%' }}></div>
        </div>
      );
    }

    if (activeTab === 'carousel' && carouselData.length > 0) {
      const slide = carouselData[currentSlide];
      return (
        <div className="generated-result">
          <div className={`result-preview ratio-${aspectRatio.replace(':', '-')}`}>
            <img src={slide.imageUrl} alt={`Slide ${currentSlide + 1}`} className="result-img" />
            <div className="slide-nav">
              <button disabled={currentSlide === 0} onClick={() => setCurrentSlide(s => s - 1)} className="btn-nav">←</button>
              <span className="slide-counter">Slide {currentSlide + 1} / {carouselData.length}</span>
              <button disabled={currentSlide === carouselData.length - 1} onClick={() => setCurrentSlide(s => s + 1)} className="btn-nav">→</button>
            </div>
          </div>
          <div className="result-info">
            <div className="result-text-header">
              <span className="text-badge">CARRUSEL</span>
              <button onClick={() => {
                navigator.clipboard.writeText(slide.text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }} className="action-button" title="Copiar texto">
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="result-body">{slide.text}</p>
            <div className="result-footer">
              {duplicatedSlideUrl && (
                <a href={duplicatedSlideUrl} target="_blank" rel="noopener noreferrer" className="btn-generate" style={{ textDecoration: 'none', background: '#34a853', width: 'auto', marginBottom: '10px', display: 'inline-flex', justifyContent: 'center' }}>
                  Abrir en Google Slides →
                </a>
              )}
              <button onClick={handleSave} className="btn-generate" style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.875rem' }} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 size={16} className="spinner" /> Guardando...</>
                ) : (
                  <><Plus size={16} /> Guardar Carrusel</>
                )}
              </button>
              <button className="btn-outline share-btn">
                <Share2 size={14} /> Compartir
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (generatedPost) {
      return (
        <div className="generated-result">
          <div className="result-image-wrapper">
            <img src={generatedPost.imageUrl} alt="Generated UI" className="result-image" />
            <span className="badge">IMAGEN IA</span>
          </div>

          <div className="result-text-box">
            <div className="result-text-header">
              <span className="text-badge">TEXTO GENERADO</span>
              <button onClick={handleCopy} className="action-button" title="Copiar texto">
                {copied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="result-body">{generatedPost.text}</p>
            <div className="result-footer">
              <button onClick={handleSave} className="btn-generate" style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.875rem' }} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spinner" /> Guardando...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Guardar en Proyectos
                  </>
                )}
              </button>
              <button className="btn-outline share-btn">
                <Share2 size={14} /> Compartir
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="empty-state">
        <ImageIcon size={48} color="var(--border-color)" />
        <p>Tu posteo aparecerá aquí una vez que termine de generarse.</p>
      </div>
    );
  };

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content">
        <div className="create-layout">
          {/* Left Column - Input */}
          <div className="create-input-col">
            <header className="create-header">
              <h1 className="create-title">Crear Contenido</h1>
              <p className="create-subtitle">Transforma tus ideas en posteos listos para publicar.</p>
            </header>

            {/* Tabs Menu */}
            <div className="tabs-container">
              <div className="tabs-wrapper">
                <button
                  className={`tab-btn ${activeTab === 'simple' ? 'active' : ''}`}
                  onClick={() => setActiveTab('simple')}
                >
                  <Layout size={16} /> Posteo Simple
                </button>
                <button
                  className={`tab-btn ${activeTab === 'carousel' ? 'active' : ''}`}
                  onClick={() => setActiveTab('carousel')}
                >
                  <Layers size={16} /> Carrusel
                </button>
                <button className="tab-btn disabled">
                  <Sparkles size={16} /> Otros
                </button>
              </div>
            </div>

            <div className="tab-pane active">
              {activeTab === 'carousel' && (
                <div className="carousel-mode-toggle" style={{ marginBottom: '24px' }}>
                  <label className="input-label">Método de Creación</label>
                  <div className="ratio-options">
                    <button
                      className={`ratio-btn ${carouselMode === 'ia' ? 'active' : ''}`}
                      onClick={() => setCarouselMode('ia')}
                    >
                      Generar con IA
                    </button>
                    <button
                      className={`ratio-btn ${carouselMode === 'slides' ? 'active' : ''}`}
                      onClick={() => {
                        setCarouselMode('slides');
                        if (googleSlides.length === 0) fetchGoogleSlides();
                      }}
                    >
                      Plantilla Google Slides
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'carousel' && carouselMode === 'ia' && (
                <div className="carousel-settings" style={{ marginBottom: '20px' }}>
                  <label className="input-label">Cantidad de Slides: {numSlides}</label>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={numSlides}
                    onChange={(e) => setNumSlides(parseInt(e.target.value))}
                    className="slider"
                    style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>
                    <span>2</span>
                    <span>10</span>
                  </div>
                </div>
              )}

              {activeTab === 'carousel' && carouselMode === 'slides' && (
                <div className="google-slides-selector" style={{ marginBottom: '24px' }}>
                  <label className="input-label">Elige una presentación de tu Drive</label>
                  {isLoadingSlides ? (
                    <div className="loading-slides"><Loader2 size={24} className="spinner" /> Cargando Slides...</div>
                  ) : (
                    <div className="slides-grid-mini">
                      {googleSlides.length > 0 ? (
                        googleSlides.map(slide => (
                          <div
                            key={slide.id}
                            className={`slide-item-mini ${selectedSlideId === slide.id ? 'active' : ''}`}
                            onClick={() => setSelectedSlideId(slide.id)}
                          >
                            <div className="slide-thumb">
                              <img src={slide.thumbnailLink || "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Google_Slides_2020_Logo.svg/1200px-Google_Slides_2020_Logo.svg.png"} alt={slide.name} />
                            </div>
                            <span className="slide-name">{slide.name}</span>
                          </div>
                        ))
                      ) : (
                        <p className="empty-msg">No se encontraron presentaciones de Google Slides.</p>
                      )}
                    </div>
                  )}
                  <button onClick={fetchGoogleSlides} className="btn-link" style={{ fontSize: '0.7rem', marginTop: '10px' }}>Actualizar lista</button>
                </div>
              )}

              <div className="aspect-ratio-selector" style={{ marginBottom: '24px' }}>
                <label className="input-label">Orientación / Formato</label>
                <div className="ratio-options">
                  <button
                    className={`ratio-btn ${aspectRatio === '1:1' ? 'active' : ''}`}
                    onClick={() => setAspectRatio('1:1')}
                  >
                    1:1
                  </button>
                  <button
                    className={`ratio-btn ${aspectRatio === '9:16' ? 'active' : ''}`}
                    onClick={() => setAspectRatio('9:16')}
                  >
                    9:16
                  </button>
                  <button
                    className={`ratio-btn ${aspectRatio === '16:9' ? 'active' : ''}`}
                    onClick={() => setAspectRatio('16:9')}
                  >
                    16:9
                  </button>
                </div>
              </div>
              <div className="prompt-card">
                <h2 className="form-title">
                  <Zap size={20} color="var(--primary)" /> Generador de Posteos
                </h2>
                <p className="form-desc">Describe de qué quieres hablar y nosotros generaremos la imagen y el texto perfecto para tus redes sociales.</p>

                <form onSubmit={handleGenerate} className="create-form">
                  <div className="input-block">
                    <label className="input-label">¿Sobre qué trata tu post?</label>
                    <textarea
                      className="prompt-textarea"
                      placeholder="Ej. Escribe un post inspirador sobre la inteligencia artificial en el diseño gráfico..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                    ></textarea>
                  </div>

                  <div className="input-block">
                    <label className="input-label">Referencia Visual (Opcional)</label>
                    <p className="form-desc" style={{ marginBottom: '10px' }}>Si quieres que el carrusel se parezca a uno que ya existe, sube una imagen de referencia.</p>

                    {refImage ? (
                      <div className="ref-image-container">
                        <img src={refImage} alt="Referencia" className="ref-image-preview" />
                        <button
                          type="button"
                          onClick={() => setRefImage(null)}
                          className="btn-remove-ref"
                          title="Quitar imagen"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="upload-box">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setRefImage(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        <Upload size={24} color="var(--primary)" />
                        <span>Sube una referencia visual</span>
                      </label>
                    )}
                  </div>


                  {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{error}</div>}

                  <button type="submit" className="btn-generate w-full justify-center" disabled={isGenerating || !prompt.trim()}>
                    {isGenerating ? (
                      <>
                        <Loader2 size={18} className="spinner" /> Generando...
                      </>
                    ) : (
                      <>
                        Generar Contenido <Zap size={18} fill="currentColor" />
                      </>
                    )}
                  </button>
                </form>
              </div> {/* Close prompt-card */}
            </div> {/* Close tab-pane */}
          </div> {/* Close create-input-col */}

          {/* Right Column - Output */}
          <div className="create-output-col">
            {/* Dynamic Output Preview */}
            <div className="prompt-preview-block" style={{ marginBottom: '16px' }}>
              <div className="preview-header">
                <Sparkles size={14} color="var(--primary)" />
                <span>Input para Gemini (Dynamic Output)</span>
              </div>
              <div className="preview-content">
                {/* MODE: Google Slides template */}
                {activeTab === 'carousel' && carouselMode === 'slides' ? (
                  slidePlaceholders.length > 0 ? (
                    // Placeholders already detected — show the actual prompt structure
                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {`Tema: "${prompt || '(sin tema aún)'}"\n\nCampos detectados en la plantilla:\n${slidePlaceholders.map(p => `  • ${p}  →  el nombre indica propósito y extensión`).join('\n')}\n\nGemini generará contenido para cada campo respetando:\n  • Jerarquía (PASO 1, PASO 2…)\n  • Extensión similar al nombre del placeholder\n  • Coherencia narrativa entre slides`}
                    </div>
                  ) : selectedSlideId ? (
                    // Slide selected but not yet processed
                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {`Tema: "${prompt || '(escribe el tema)'}"\n\nAl generar, se detectarán los {{placeholders}} de la plantilla.\nEl nombre de cada placeholder guiará a Gemini sobre:\n  • Qué contenido generar\n  • La extensión/longitud esperada\n  • La jerarquía del slide (título, cuerpo, paso, etc.)`}
                    </div>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
                      Selecciona una plantilla de Google Slides para ver el prompt dinámico...
                    </span>
                  )
                ) : !prompt.trim() ? (
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>Escribe algo para ver el prompt dinámico...</span>
                ) : activeTab === 'carousel' ? (
                  /* MODE: AI carousel */
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {`Genera un carrusel de ${numSlides} slides basado en: "${prompt}".\nRetorna un JSON con { style_guide, slides: [{ text, image_prompt }] }`}
                  </div>
                ) : (
                  /* MODE: Simple post */
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {`Basado en "${prompt}", genera:\n1. Post para redes sociales.\n2. Descripción visual (IMAGE_PROMPT).`}
                  </div>
                )}
              </div>
            </div>

            <div className="output-card">
              <div className="output-header">
                <h3 className="output-title">Resultado Generado</h3>
                {isGenerating && <span className="status-badge">IA TRABAJANDO...</span>}
              </div>

              <div className="output-body">
                {error && <div className="error-message">{error}</div>}
                {renderResult()}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateContent;
