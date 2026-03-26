import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
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
  Check,
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EditableSlide } from '../components/CarouselEditor';
import './CreateContent.css';

const CreateContent = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('simple'); // 'simple' | 'carousel'
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [generatedPost, setGeneratedPost] = useState<{ text: string, imageUrl: string } | null>(null);
  const [carouselData, setCarouselData] = useState<Array<{ text: string, imageUrl: string }>>([]);
  const [editableCarouselData, setEditableCarouselData] = useState<EditableSlide[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [numSlides, setNumSlides] = useState(5);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [refImage, setRefImage] = useState<string | null>(null); // Base64 of referenced image
  const [aspectRatio, setAspectRatio] = useState('1:1'); // '1:1' | '16:9' | '9:16'
  const [imageModel, setImageModel] = useState('nano-banana-2'); // 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro'
  const [usageMetrics, setUsageMetrics] = useState<{ tokens: number, cost: number } | null>(null);
  const [carouselMode, setCarouselMode] = useState('ia'); // 'ia' | 'slides'
  const [googleSlides, setGoogleSlides] = useState<any[]>([]);
  const [isLoadingSlides, setIsLoadingSlides] = useState(false);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [duplicatedSlideUrl, setDuplicatedSlideUrl] = useState<string | null>(null);
  const [slidePlaceholders, setSlidePlaceholders] = useState<string[]>([]); // Placeholders detected from the selected template
  const [slideConfigs, setSlideConfigs] = useState<Array<{ prompt: string, refImage: string | null }>>([]);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Auto-hide toast after 3s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Sync slide configs array length with numSlides
  useEffect(() => {
    setSlideConfigs(prev => {
      if (prev.length === numSlides) return prev;
      const newArr = [...prev];
      while (newArr.length < numSlides) newArr.push({ prompt: '', refImage: null });
      return newArr.slice(0, numSlides);
    });
  }, [numSlides]);

  const updateSlideConfig = (index: number, field: 'prompt' | 'refImage', value: string | null) => {
    setSlideConfigs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

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
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

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
      const usage = geminiRes.response?.usageMetadata;
      if (usage) {
        setUsageMetrics({
          tokens: usage.totalTokenCount || 0,
          cost: (usage.promptTokenCount / 1000000) * 0.075 + (usage.candidatesTokenCount / 1000000) * 0.30
        });
      }

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

  const uploadImageToStorage = async (base64OrUrl: string, userId: string): Promise<string> => {
    if (!base64OrUrl.startsWith('data:image')) return base64OrUrl;

    try {
      const res = await fetch(base64OrUrl);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'png';
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Upload to 'content-assets' bucket
      const { error } = await supabase.storage.from('content-assets').upload(fileName, blob, {
        contentType: blob.type
      });

      if (error) throw error;

      const { data } = supabase.storage.from('content-assets').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.error("Error uploading image to storage:", err);
      throw new Error("No se pudo subir la imagen. Verifica que el bucket 'content-assets' exista en Supabase y sea público.");
    }
  };

  const handleSave = async () => {
    if (!generatedPost && carouselData.length === 0) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");

      const isCarousel = activeTab === 'carousel';

      let finalDescription = '';
      let finalImageUrl = '';

      if (isCarousel) {
        // Upload all carousel slides to Supabase Storage
        const processedSlides = await Promise.all(
          carouselData.map(async (slide) => {
            const url = await uploadImageToStorage(slide.imageUrl, user.id);
            return { ...slide, imageUrl: url };
          })
        );
        finalDescription = JSON.stringify(processedSlides);
        finalImageUrl = processedSlides[0]?.imageUrl || '';
      } else {
        // Upload single image
        if (generatedPost?.imageUrl) {
          finalImageUrl = await uploadImageToStorage(generatedPost.imageUrl, user.id);
        }
        finalDescription = generatedPost?.text || '';
      }

      const { error } = await supabase
        .from('content')
        .insert({
          user_id: user.id,
          title: prompt.slice(0, 30) + (prompt.length > 30 ? '...' : ''),
          description: finalDescription,
          content_type: isCarousel ? 'CAROUSEL' : 'SOCIAL',
          image_url: finalImageUrl,
          prompt: prompt,
        });

      if (error) throw error;
      setToastMessage({ type: 'success', text: '¡Contenido guardado exitosamente!' });
    } catch (err: any) {
      console.error("Error saving content:", err);
      setToastMessage({ type: 'error', text: "Error al guardar: " + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setGenerationLogs(["Iniciando proceso..."]);
    setGeneratedPost(null);
    setCarouselData([]); // Clear carousel data on new generation
    setEditableCarouselData([]); // Clear editable data
    setCurrentSlide(0); // Reset slide counter
    setCopied(false);
    setError(null);
    setUsageMetrics(null);

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
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192
        }
      });

      if (activeTab === 'carousel' && carouselMode === 'slides') {
        if (!selectedSlideId) throw new Error("Por favor selecciona una presentación de Google Slides.");
        setIsGenerating(false); // Reset generating state to let processGoogleSlides handle it
        await processGoogleSlides(selectedSlideId);
        return;
      }

      if (activeTab === 'carousel') {
        if (carouselMode === 'html') {
          let width = 1080;
          let height = 1080;
          if (aspectRatio === '9:16') { width = 1080; height = 1920; }
          else if (aspectRatio === '16:9') { width = 1920; height = 1080; }

          setGenerationLogs(prev => [...prev, "Analizando requerimientos y programando el código HTML Tailwind de cada slide con Gemini 3.0..."]);

          const carouselPrompt = `
Eres un Front-End Developer Senior experto en generar UI/UX mediante HTML y Tailwind CSS como Google Stitch. Tu tarea es construir un carrusel de ${numSlides} slides basado en la idea: "${prompt}".

Las dimensiones del canvas de cada slide serán de exactamente ${width} píxeles de ancho y ${height} píxeles de alto.

INSTRUCCIONES CRÍTICAS:
1. DEBES DEVOLVER ESTRICTAMENTE UN JSON VÁLIDO con un array de strings HTML.
2. Cada string HTML devuelto en el JSON representa el contenido completo e independiente de UN slide.
3. UTILIZA TAILWIND CSS CLASES NATIVAS de forma extensiva en tus tags HTML (\`flex, absolute, grid, bg-slate-950, text-white, justify-center, rounded-2xl\`, etc.). 
4. Tu HTML SOLO debe contener código de la etiqueta hacia adentro, SIN metadatos, SIN head, SIN body. Solo devuelve el \`div\` contenedor padre y sus hijos.
5. CREA DISEÑOS PREMIUM Y MODERNOS: fondos tipo Glassmorphism (\`bg-white/5 backdrop-blur-xl\`), gradientes complejos (\`bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500\`), tipografías enormes de alto impacto. 
6. Puedes usar flexbox o absolute positioning para la maquetación. Asegurate de dejar un margen enorme (ej: \`p-20\`) para que el contenido "respire".
7. Cada slide debe ser visualmente cohesivo pero no exactamente idéntico. Variará en texto y distribución según el contenido sugerido.
8. Para fuentes de iconos, utiliza la clase \`material-symbols-outlined\`.

EJEMPLO DE HTML BASE DE UN SLIDE QUE DEVUELVES ADENTRO DE UN ELEMENTO DEL ARRAY:
<div class="w-full h-full bg-[BACKGROUND_COLOR] text-[TEXT_COLOR] flex relative overflow-hidden font-['Space_Grotesk']">
  <aside class="w-64 border-r border-white/10 flex flex-col py-6 px-4 bg-slate-950/80 backdrop-blur-xl shadow-[0_10px_15px_-3px_rgba(140,43,238,0.2)]">
    <div class="mb-10 px-2">
      <h1 class="text-xl font-bold tracking-tighter text-slate-100">[APP_NAME]</h1>
      <p class="text-[10px] uppercase tracking-[0.2em] text-[ACCENT_COLOR] font-bold mt-1">[APP_SUBTITLE]</p>
    </div>
    <nav class="flex-1 space-y-1">
      <!-- Navegación lateral genérica -->
      <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all duration-200 group" href="#">
        <span class="material-symbols-outlined text-xl" data-icon="dashboard">dashboard</span>
        <span class="text-sm font-medium">Dashboard</span>
      </a>
      <!-- Active State -->
      <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[ACCENT_COLOR]/10 border border-[ACCENT_COLOR]/20 text-[ACCENT_COLOR] font-bold transition-all duration-200" href="#">
        <span class="material-symbols-outlined text-xl" data-icon="extension">extension</span>
        <span class="text-sm font-medium">[ACTIVE_TAB_NAME]</span>
      </a>
    </nav>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 flex flex-col h-full overflow-hidden bg-[BACKGROUND_COLOR] relative">
      <!-- TopNavBar -->
      <header class="w-full h-16 flex items-center justify-between px-8 bg-transparent text-sm">
        <div class="flex items-center flex-1 max-w-xl">
           <div class="relative w-full group">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input class="w-full bg-white/5 border-none rounded-xl py-2 pl-10 pr-4 text-slate-200 placeholder:text-slate-500 outline-none" placeholder="[SEARCH_PLACEHOLDER]" type="text"/>
           </div>
        </div>
      </header>
      
      <!-- Content Area (Aquí va la lógica fuerte de cada slide) -->
      <div class="flex-1 overflow-y-auto px-8 pb-12">
          <div class="mt-8 mb-10">
              <h2 class="text-3xl font-bold tracking-tight text-white">[MAIN_TITLE]</h2>
              <p class="text-slate-400 mt-2">[MAIN_DESCRIPTION]</p>
          </div>
          
          <!-- Elementos de Categorías -->
          <div class="flex items-center gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
              <button class="px-5 py-2 rounded-full text-sm font-bold bg-[ACCENT_COLOR]/10 border border-[ACCENT_COLOR]/20 text-[ACCENT_COLOR] whitespace-nowrap">All</button>
              <button class="px-5 py-2 rounded-full text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all whitespace-nowrap">[CATEGORY_1]</button>
          </div>
          
          <!-- Integrations Grid / Cards content -->
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <!-- Card 1 -->
              <div class="rounded-lg border-l-4 border-[CARD_1_COLOR] relative group overflow-hidden bg-white/5 backdrop-blur-md p-6">
                  <div class="absolute inset-0 bg-[CARD_1_COLOR]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div class="relative flex justify-between items-start mb-4">
                      <div class="w-12 h-12 rounded-lg bg-[CARD_ICON_BG] flex items-center justify-center">
                          <span class="material-symbols-outlined text-[CARD_1_COLOR] text-3xl">[ICON_NAME]</span>
                      </div>
                  </div>
                  <h3 class="text-lg font-bold text-white mb-1">[CARD_TITLE]</h3>
                  <p class="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-6">[CARD_CATEGORY]</p>
                  <div class="flex items-center justify-between mt-auto">
                      <span class="text-sm text-green-400 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>Connected</span>
                  </div>
              </div>
          </div>
          
          <!-- Promotion Section / Bottom Call To Action -->
          <div class="mt-12 rounded-2xl p-8 bg-gradient-to-r from-[ACCENT_COLOR]/10 to-cyan-500/10 border border-white/5 relative overflow-hidden group">
              <div class="absolute -right-20 -top-20 w-64 h-64 bg-[ACCENT_COLOR]/20 blur-[80px] rounded-full group-hover:scale-110 transition-transform duration-700"></div>
              <div class="relative z-10">
                  <div class="flex items-center gap-3 mb-4">
                      <span class="px-2 py-1 rounded bg-white/10 text-[10px] font-bold uppercase tracking-wider text-[ACCENT_COLOR]">[TAG_TEXT]</span>
                      <h4 class="text-xl font-bold text-white">[CTA_TITLE]</h4>
                  </div>
                  <p class="text-slate-400 max-w-lg mb-6 leading-relaxed">[CTA_DESCRIPTION]</p>
                  <button class="bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2">
                       [CTA_BUTTON_TEXT] <span class="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
              </div>
          </div>
      </div>
  </main>
</div>

FORMATO DE SALIDA ESPERADO DEL MODELO (ESTRICTO):
{
  "google_fonts": ["Space Grotesk", "Outfit", "Inter"],
  "slides_html_strings": [
    "<div class='w-full h-full bg-[BACKGROUND_COLOR] flex flex-col relative overflow-hidden...'>...resto del HTML basado en el ejemplo...</div>",
    "<div class='w-full h-full bg-[BACKGROUND_COLOR] flex flex-col relative overflow-hidden...'>...resto del HTML basado en el ejemplo...</div>"
  ]
}

TEN EN CUENTA ESTO PARA EL RESULTADO FINAL: 
No incluyas variables como [BACKGROUND_COLOR] literalmente en el resultado, sino los colores reales hexadecimales o de tailwind (ej: #0a050f o purple-500) según lo que el usuario pidió y lo que infieres de la imagen de referencia. Úsalos como una guía de qué elementos son dinámicos. Ten súper cuidado de ESCAPAR CORRECTAMENTE LAS COMILLAS dentro del JSON, o aún mejor, usa puras comillas simples dentro de los atributos HTML.

Consideraciones particulares de contenido por slide (si fueron provistas por el usuario):
${slideConfigs.map((cfg, i) => cfg.prompt ? `Slide ${i + 1}: ${cfg.prompt}` : '').filter(Boolean).join('\n')}
          `;

          const parts: any[] = [{ text: carouselPrompt }];
          if (refImage) {
            parts.push({ inlineData: { mimeType: "image/png", data: refImage.split(',')[1] } });
            parts.push({ text: "REFERENCIA ESTÉTICA EXTRICTA Y OBLIGATORIA: Inspecciona cada pixel de la imagen de referencia. Identifica sus gradientes exactos (ej. púrpuras, fondos oscuros verdosos), las texturas que presenta (ej. backgrounds noise, glassmorfismo), alineación y fuentes. Debes generar el HTML con los valores HEX reales (ej: bg-[#0D0B14], text-[#DAB9FF]) incrustados en las utilidades de Tailwind en vez de usar las variables del ejemplo." });
          }

          const result = await model.generateContent(parts);
          const usage = result.response?.usageMetadata;
          if (usage) {
            setUsageMetrics({
              tokens: usage.totalTokenCount || 0,
              cost: (usage.promptTokenCount / 1000000) * 0.075 + (usage.candidatesTokenCount / 1000000) * 0.30
            });
          }
          let cleanText = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

          let data;
          try {
            data = JSON.parse(cleanText);
          } catch (e) {
            console.error("Fallo parseo JSON:", cleanText);
            throw new Error("JSON Inválido devuelto por el modelo. Por favor vuelve a intentarlo.");
          }

          // Convertimos strings HTML a Slide Objects
          const rawHtmlArray = data.slides_html_strings || data.slides || data.html_strings || [];
          if (rawHtmlArray.length === 0) {
            throw new Error("El modelo generó un arreglo de slides vacío.");
          }

          const finalSlides = rawHtmlArray.map((htmlStr: string, i: number) => ({
            id: `slide-${i}`,
            html: htmlStr
          }));

          setGenerationLogs(prev => [...prev, "Procesando HTML final y compilando estilos Tailwind dinámicamente..."]);

          // Cargar Google Fonts
          if (data.google_fonts && Array.isArray(data.google_fonts)) {
            const fontUrl = `https://fonts.googleapis.com/css2?${data.google_fonts.map((f: string) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900`).join('&')}&display=swap`;
            const fontLink = document.createElement('link');
            fontLink.href = fontUrl;
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
            await new Promise(r => setTimeout(r, 600));
            localStorage.setItem('contentlab-editable-fonts', JSON.stringify(data.google_fonts));
          }

          // Cargar CDN de Tailwind si falta
          if (!document.getElementById("tailwind-cdn")) {
            const tailwindScript = document.createElement("script");
            tailwindScript.id = "tailwind-cdn";
            tailwindScript.src = "https://cdn.tailwindcss.com";
            document.head.appendChild(tailwindScript);
            // Si recién se carga, darle tiempo inicial
            await new Promise(r => setTimeout(r, 1000));
          }

          const container = document.createElement('div');
          // Important: it cannot be hidden with display:none or html2canvas skips it.
          // Keep it fixed outside the viewport.
          container.style.position = 'fixed';
          container.style.left = '200vw';
          container.style.top = '0';
          container.style.width = width + 'px';
          container.style.height = height + 'px';
          // Agregamos bg color default para exportaciones limpias.
          container.style.backgroundColor = '#0a050f';
          document.body.appendChild(container);

          const pngSlides = [];
          for (let i = 0; i < finalSlides.length; i++) {
            const slide = finalSlides[i];

            // Inyectar HTML e inferir compilación Tailwind.
            container.innerHTML = `
              <div style="width: 100%; height: 100%; overflow: hidden;">
                ${slide.html}
              </div>
            `;

            // Forzar una pequeñísima mutación de clase para que CDN Tailwind procese a la fuerza (trick)
            container.classList.add('tw-process-' + i);

            // Pausa obligatoria extendida para que Tailwind genere los estilos de las clases nuevas CSSOM
            await new Promise(r => setTimeout(r, 1500));

            const canvas = await html2canvas(container, {
              scale: 1,
              useCORS: true,
              logging: false,
              backgroundColor: null // let the html dictate the color
            });
            pngSlides.push({ text: "Abre el editor para modificar texto", imageUrl: canvas.toDataURL("image/png", 0.9) });
          }

          document.body.removeChild(container);

          setEditableCarouselData(finalSlides);
          setCarouselData(pngSlides);

        } else if (carouselMode === 'ia') {
          const carouselPrompt = `
          Genera un carrusel de ${numSlides} slides basado en la idea general: "${prompt}".
          ${refImage ? "Como referencia visual general, usa la imagen adjunta para el estilo." : ""}
          Retorna un JSON con este formato EXACTO: 
          {
            "style_guide": "una descripción corta del estilo visual (ej: flat vector, cyberpunk, minimalist 3d)",
            "slides": [
              { "text": "texto corto del slide", "image_prompt": "descripción de la imagen asegurando mencionar textualmente palabras clave específicas que el usuario pidió entre comillas para ser renderizadas como tipografía visual" }
            ]
          }
          
          INSTRUCCIÓN MUY IMPORTANTE: Si la idea general o la configuración de alguna slide exige usar palabras específicas o frases literales, DEBES INCLUIRLAS ESTRICTAMENTE en "text" e incorporarlas como instrucción dentro de "image_prompt" (ej. "La imagen debe tener tipografía visible con la palabra X").

          Consideraciones particulares por slide (si fueron provistas por el usuario):
          ${slideConfigs.map((cfg, i) => cfg.prompt ? `Slide ${i + 1}: ${cfg.prompt}` : '').filter(Boolean).join('\\n')}
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
          let tk = 0;
          let cst = 0;
          const usage = result.response?.usageMetadata;
          if (usage) {
            tk = usage.totalTokenCount || 0;
            cst += (usage.promptTokenCount / 1000000) * 0.075 + (usage.candidatesTokenCount / 1000000) * 0.30;
          }

          const textResponse = result.response.text();
          const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanText);
          const style = data.style_guide;

          const finalSlides = [];
          for (let i = 0; i < data.slides.length; i++) {
            const slide = data.slides[i];
            const slideRefImg = slideConfigs[i]?.refImage || refImage;

            cst += imageModel === "nano-banana" ? 0.01 : imageModel === "nano-banana-pro" ? 0.03 : 0.01;
            if (!settings.nano_banana_api_key) {
              throw new Error("Por favor configura tu Nano Banana API Key (Google API Key) en Configuración.");
            }
            let apiModel = "gemini-3.1-flash-image-preview";
            if (imageModel === "nano-banana") apiModel = "imagen-3.0-fast-generate-001";
            if (imageModel === "nano-banana-pro") apiModel = "imagen-3.0-generate-001";

            const isImagen = apiModel.startsWith("imagen");
            let imgRes;

            if (isImagen) {
              // Imagen usa el endpoint /predict y una firma diferente
              imgRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:predict?key=${settings.nano_banana_api_key}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  instances: [{ prompt: `High quality digital art. ${slide.image_prompt}. INCLUIR COMO TIPOGRAFÍA Y DISEÑO GRÁFICO TEXTUAL DENTRO DE LA IMAGEN: "${slide.text}". Estilo: ${style}.` }],
                  parameters: { sampleCount: 1, aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '9:16' ? '9:16' : '16:9' }
                })
              });
            } else {
              // Gemini (Image Preview) usa /generateContent
              const imgParts: any[] = [{ text: `FORMATO ${aspectRatio === '9:16' ? 'VERTICAL 9:16' : aspectRatio === '16:9' ? 'HORIZONTAL 16:9' : 'CUADRADO 1:1'}. ${slide.image_prompt}. DEBES INCLUIR COMO TIPOGRAFÍA Y DISEÑO GRÁFICO CLARAMENTE CENTRAL DENTRO DE LA IMAGEN: "${slide.text}". Estilo: ${style}. High quality digital art.` }];

              if (slideRefImg) {
                imgParts.push({ inlineData: { mimeType: "image/png", data: slideRefImg.split(',')[1] } });
                imgParts[0].text += "\\nIMPORTANTE: DEBES RECREAR ESTA IMAGEN DE REFERENCIA EXACTAMENTE (misma composición, colores y estilo) PERO reemplazando textos e ilustraciones de manera coherente con el prompt.";
              }

              imgRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${settings.nano_banana_api_key}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: imgParts }],
                  generationConfig: {
                    responseModalities: ["IMAGE"]
                  }
                })
              });
            }

            if (!imgRes.ok) {
              const errorData = await imgRes.json();
              throw new Error(errorData.error?.message || "Error al llamar a Google AI Studio para imagen de carrusel");
            }
            const imgData = await imgRes.json();

            // Extraer Base64 dependiendo de la respuesta (Gemini o Imagen)
            let base64 = null;
            if (isImagen) {
              base64 = imgData.predictions?.[0]?.bytesBase64Encoded;
            } else {
              base64 = imgData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            }
            finalSlides.push({
              text: slide.text,
              imageUrl: base64 ? `data:image/png;base64,${base64}` : "https://via.placeholder.com/1080"
            });
          }
          setCarouselData(finalSlides);
          setUsageMetrics({ tokens: tk, cost: cst });
          // setGeneratedPost({ text: "Carrusel generado exitosamente", imageUrl: finalSlides[0].imageUrl }); // No longer needed as renderResult handles carousel directly
        } // <-- Added brace here
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
        let tk = 0;
        let cst = 0;
        const usage = result.response?.usageMetadata;
        if (usage) {
          tk = usage.totalTokenCount || 0;
          cst += (usage.promptTokenCount / 1000000) * 0.075 + (usage.candidatesTokenCount / 1000000) * 0.30;
        }

        const output = result.response.text();

        const responseText = output.split('IMAGE_PROMPT:')[0].replace('TEXTO:', '').trim();
        const visualPrompt = output.split('IMAGE_PROMPT:')[1]?.trim() || "modern professional digital art";

        // 2. Generate Image with Nano Banana 2 (Google AI Studio API Call)
        cst += imageModel === "nano-banana" ? 0.01 : imageModel === "nano-banana-pro" ? 0.03 : 0.01;

        let imageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

        if (!settings.nano_banana_api_key) {
          throw new Error("Por favor configura tu Nano Banana API Key (Google API Key) en Configuración.");
        }

        try {
          let apiModel = "gemini-3.1-flash-image-preview";
          if (imageModel === "nano-banana") apiModel = "imagen-3.0-fast-generate-001";
          if (imageModel === "nano-banana-pro") apiModel = "imagen-3.0-generate-001";

          const isImagen = apiModel.startsWith("imagen");
          let response;

          if (isImagen) {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:predict?key=${settings.nano_banana_api_key}`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instances: [{ prompt: `High-quality professional social media image: ${visualPrompt}. Cyberpunk nebula style, premium digital art.` }],
                parameters: { sampleCount: 1, aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '9:16' ? '9:16' : '16:9' }
              })
            });
          } else {
            const imgParts: any[] = [{ text: `FORMATO ${aspectRatio === '9:16' ? 'VERTICAL 9:16' : aspectRatio === '16:9' ? 'HORIZONTAL 16:9' : 'CUADRADO 1:1'}. Generate a high-quality, professional social media image for this post: ${visualPrompt}. Cyberpunk nebula style, premium digital art.` }];

            if (refImage) {
              imgParts.push({ inlineData: { mimeType: "image/png", data: refImage.split(',')[1] } });
              imgParts[0].text += "\\nIMPORTANTE: DEBES RECREAR ESTA IMAGEN DE REFERENCIA EXACTAMENTE (misma composición, estructura general y estilo) PERO reemplazando elementos acordes al prompt.";
            }

            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${settings.nano_banana_api_key}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [{ parts: imgParts }],
                generationConfig: {
                  responseModalities: ["IMAGE"]
                }
              })
            });
          }

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Error al llamar a Google AI Studio");
          }

          const data = await response.json();

          // Extraer la imagen en Base64 según tipo de API
          let imageDataByte = null;
          let mimeType = "image/png";

          if (isImagen) {
            imageDataByte = data.predictions?.[0]?.bytesBase64Encoded;
            mimeType = "image/jpeg"; // Imagen defaults to JPEG Base64 payload without mimetype declared in output
          } else {
            imageDataByte = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            mimeType = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "image/png";
          }

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
        setUsageMetrics({ tokens: tk, cost: cst });
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
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="spinner" size={32} />
            <p className="text-muted font-medium">Generando contenido...</p>
            <div style={{ textAlign: 'left', marginTop: '1rem', width: '100%', maxWidth: '400px', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
              {generationLogs.map((log, idx) => (
                <p key={idx} style={{ fontSize: '0.8rem', color: '#ccc', margin: '4px 0', display: 'flex', gap: '8px' }}>
                  <span style={{ color: 'var(--primary)' }}>•</span> {log}
                </p>
              ))}
            </div>
          </div>
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
            <div className="result-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              {duplicatedSlideUrl && (
                <a href={duplicatedSlideUrl} target="_blank" rel="noopener noreferrer" className="btn-generate" style={{ textDecoration: 'none', background: '#34a853', width: 'auto', display: 'inline-flex', justifyContent: 'center' }}>
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {carouselMode === 'html' && editableCarouselData.length > 0 && (
                  <button
                    onClick={() => {
                      localStorage.setItem('contentlab-editable-slides', JSON.stringify(editableCarouselData));
                      localStorage.setItem('contentlab-editable-ratio', aspectRatio);
                      navigate('/editor');
                    }}
                    className="btn-outline share-btn"
                    title="Abrir editor avanzado en nueva pestaña"
                    style={{ background: 'rgba(157, 78, 221, 0.15)', borderColor: 'var(--primary)', color: 'white' }}
                  >
                    Abrir Editor 🎨
                  </button>
                )}
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = slide.imageUrl;
                    link.download = `contentlab-slide-${currentSlide + 1}.png`;
                    link.click();
                  }}
                  className="btn-outline share-btn"
                  title="Descargar esta slide como imagen PNG"
                >
                  <Download size={14} /> Descargar
                </button>
                <button className="btn-outline share-btn">
                  <Share2 size={14} /> Compartir
                </button>
              </div>
            </div>
            {usageMetrics && (
              <div className="usage-metrics" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="#eab308" /> Tokens Gastados: {usageMetrics.tokens.toLocaleString()}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>$</span> Costo Estimado: ${usageMetrics.cost.toFixed(4)} USD
                </span>
              </div>
            )}
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
            {usageMetrics && (
              <div className="usage-metrics" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="#eab308" /> Tokens Gastados: {usageMetrics.tokens.toLocaleString()}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>$</span> Costo Estimado: ${usageMetrics.cost.toFixed(4)} USD
                </span>
              </div>
            )}
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
                      Imágenes IA
                    </button>
                    <button
                      className={`ratio-btn ${carouselMode === 'html' ? 'active' : ''}`}
                      onClick={() => setCarouselMode('html')}
                    >
                      Diseño HTML
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

              {activeTab === 'carousel' && ['ia', 'html'].includes(carouselMode) && (
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

              {!(activeTab === 'carousel' && (carouselMode === 'slides' || carouselMode === 'html')) && (
                <div className="model-selector" style={{ marginBottom: '24px' }}>
                  <label className="input-label">Modelo Generador de Imágenes</label>
                  <div className="ratio-options">
                    <button
                      className={`ratio-btn ${imageModel === 'nano-banana' ? 'active' : ''}`}
                      onClick={() => setImageModel('nano-banana')}
                      type="button"
                    >
                      Nano Banana
                    </button>
                    <button
                      className={`ratio-btn ${imageModel === 'nano-banana-2' ? 'active' : ''}`}
                      onClick={() => setImageModel('nano-banana-2')}
                      type="button"
                    >
                      Nano Banana 2
                    </button>
                    <button
                      className={`ratio-btn ${imageModel === 'nano-banana-pro' ? 'active' : ''}`}
                      onClick={() => setImageModel('nano-banana-pro')}
                      type="button"
                    >
                      Nano Banana Pro
                    </button>
                  </div>
                </div>
              )}

              {!(activeTab === 'carousel' && carouselMode === 'slides') && (
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
              )}

              <div className="prompt-card">
                <h2 className="form-title">
                  <Zap size={20} color="var(--primary)" /> {activeTab === 'carousel' ? 'Detalles del Carrusel' : 'Generador de Posteos'}
                </h2>
                <p className="form-desc">{activeTab === 'carousel' ? 'Danos la idea general del flujo del carrusel o personaliza cada slide.' : 'Describe de qué quieres hablar y nosotros generaremos la imagen y el texto perfecto para tus redes sociales.'}</p>

                <form onSubmit={handleGenerate} className="create-form">
                  <div className="input-block">
                    <label className="input-label">{activeTab === 'carousel' ? 'Idea General del Carrusel' : '¿Sobre qué trata tu post?'}</label>
                    <textarea
                      className="prompt-textarea"
                      placeholder="Ej. Escribe un carrusel educativo sobre Inteligencia Artificial..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                    ></textarea>
                  </div>

                  {!(activeTab === 'carousel' && carouselMode === 'slides') && (
                    <div className="input-block">
                      <label className="input-label">Imagen de Referencia General (Opcional)</label>
                      <p className="form-desc" style={{ marginBottom: '10px' }}>Si quieres que el contenido se parezca a uno que ya existe, sube una imagen de estilo visual.</p>

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
                        <label className="upload-box" style={{ padding: '1.25rem' }}>
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
                          <Upload size={20} color="var(--primary)" />
                          <span>Sube una referencia visual general</span>
                        </label>
                      )}
                    </div>
                  )}

                  {activeTab === 'carousel' && ['ia', 'html'].includes(carouselMode) && (
                    <div className="slides-config-container">
                      <div className="separator" style={{ margin: '0.5rem 0 1.5rem' }}>Control por Slide</div>
                      <div className="slide-configs-list">
                        {slideConfigs.map((cfg, idx) => (
                          <div key={idx} className="slide-config-card">
                            <div className="slide-config-header">
                              <span className="slide-config-badge">SLIDE {idx + 1}</span>
                            </div>
                            <div className="input-block" style={{ marginBottom: '12px' }}>
                              <label className="input-label" style={{ fontSize: '0.75rem' }}>Idea o texto específico (Opcional)</label>
                              <input
                                type="text"
                                className="input"
                                placeholder="Ej. Explicar el concepto de machine learning con un gráfico"
                                value={cfg.prompt}
                                onChange={(e) => updateSlideConfig(idx, 'prompt', e.target.value)}
                                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)' }}
                              />
                            </div>
                            <div className="input-block">
                              <label className="input-label" style={{ fontSize: '0.75rem' }}>Referencia visual única (Opcional)</label>
                              {cfg.refImage ? (
                                <div className="ref-image-container" style={{ height: '70px', borderRadius: '4px' }}>
                                  <img src={cfg.refImage} alt="Referencia slide" className="ref-image-preview" />
                                  <button
                                    type="button"
                                    onClick={() => updateSlideConfig(idx, 'refImage', null)}
                                    className="btn-remove-ref"
                                    style={{ width: '20px', height: '20px' }}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <label className="upload-box" style={{ padding: '0.5rem', minHeight: 'auto', flexDirection: 'row', gap: '8px' }}>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => updateSlideConfig(idx, 'refImage', reader.result as string);
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  <Upload size={14} color="var(--primary)" />
                                  <span style={{ fontSize: '0.75rem' }}>Agregar imagen para esta slide</span>
                                </label>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


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

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={20} /> : <X size={20} />}
          <span style={{ fontWeight: 500 }}>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};

export default CreateContent;
