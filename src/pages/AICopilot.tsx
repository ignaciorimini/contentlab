import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Send, Bot, User, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './AICopilot.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    isQuickAction?: boolean;
}

const AICopilot = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userContent, setUserContent] = useState<any[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Initial welcome message
        setMessages([
            {
                role: 'assistant',
                content: `¡Hola! Soy tu AI Copilot. Estoy analizando tus posteos anteriores y métricas para darte las mejores sugerencias. ¿En qué te puedo ayudar hoy?`,
            }
        ]);

        // Fetch context
        fetchUserContext();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const fetchUserContext = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Get latest 10 contents
            const { data } = await supabase
                .from('content')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (data) setUserContent(data);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Please log in");

            const { data: settings } = await supabase
                .from('user_settings')
                .select('gemini_api_key')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!settings?.gemini_api_key) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Para usar el AI Copilot, primero necesitas configurar tu API Key de Gemini en Ajustes (Settings).' }]);
                setIsLoading(false);
                return;
            }

            const genAI = new GoogleGenerativeAI(settings.gemini_api_key);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            // Build context string from user content
            const recentPostsText = userContent.length > 0
                ? userContent.map(c => `[${c.content_type}] Título: ${c.title}`).join('\\n')
                : "El usuario aún no ha creado posteos en Content Lab.";

            const systemContext = `
        Eres el "AI Copilot" de Content Lab, un estratega de contenido, experto en marketing digital y redes sociales.
        Ayudas al usuario a generar ideas, analizar sus patrones y sugerir próximos contenidos (carruseles de instagram, posteos de linkedin, etc).
        
        Aquí tienes el contexto del usuario (sus últimos ${userContent.length} contenidos generados en la plataforma):
        ${recentPostsText}

        INSTRUCCIONES CLAVES:
        1. Responde de manera profesional, creativa, pero concisa (no seas demasiado extenso).
        2. Usa el estilo de formateo markdown.
        3. Fomenta al usuario a usar el creador de contenido de la plataforma.
        4. Si el usuario te pide crear un contenido directamente, puedes sugerir un prompt o darle el boton de acción. (Por ahora puedes usar formato texto libre, y sugerir títulos o copys).
      `;

            // Build history
            const history = messages.slice(1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const chat = model.startChat({
                history: [
                    { role: 'user', parts: [{ text: systemContext }] },
                    { role: 'model', parts: [{ text: 'Entendido. Estoy listo.' }] },
                    ...history
                ],
                generationConfig: {
                    maxOutputTokens: 2000,
                }
            });

            const result = await chat.sendMessage(userMessage);
            const responseText = result.response.text();

            setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);

        } catch (error: any) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Oops, hubo un error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (prompt: string) => {
        navigate('/create', { state: { initialPrompt: prompt } });
    };

    return (
        <div className="copilot-container">
            <Sidebar />
            <main className="copilot-main">
                <header className="copilot-header">
                    <div className="title-wrapper">
                        <Sparkles className="header-icon" />
                        <div>
                            <h1>AI Copilot</h1>
                            <p>Tu estratega personal de contenido con contexto de tu cuenta</p>
                        </div>
                    </div>
                </header>

                <div className="chat-interface">
                    <div className="messages-area">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message-row ${msg.role}`}>
                                <div className="message-bubble">
                                    <div className="message-avatar">
                                        {msg.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
                                    </div>
                                    <div className="message-content">
                                        <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\\n/g, '<br/>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>') }} />
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message-row assistant">
                                <div className="message-bubble">
                                    <div className="message-avatar">
                                        <Loader2 size={20} className="animate-spin" />
                                    </div>
                                    <div className="message-content loading-typing">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="quick-actions-bar">
                        <span>Ideas Rápidas:</span>
                        <button onClick={() => setInput('¿Qué tipo de carrusel puedo subir mañana que tenga buen engagement?')} className="quick-action-btn">Ideas de carruseles</button>
                        <button onClick={() => setInput('Basado en mis posteos anteriores, ¿De qué temas debería hablar más?')} className="quick-action-btn">Analizar mi temática</button>
                    </div>

                    <form onSubmit={handleSend} className="chat-input-area">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Pregúntame sobre tu estrategia de contenido..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={!input.trim() || isLoading} className="send-btn">
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AICopilot;
