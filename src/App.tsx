import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateContent from './pages/CreateContent';
import ContentDetail from './pages/ContentDetail';
import Settings from './pages/Settings';
import Landing from './pages/Landing';
import Marketplace from './pages/Marketplace';
import EditorPage from './pages/Editor';
import Integrations from './pages/Integrations';
import Metrics from './pages/Metrics';
import AICopilot from './pages/AICopilot';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe first so we catch the SIGNED_IN event from OAuth redirects
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // Then get current session (handles normal page loads)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={!session ? <Landing /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/register"
          element={!session ? <Register /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/dashboard"
          element={session ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/create"
          element={session ? <CreateContent /> : <Navigate to="/login" />}
        />
        <Route
          path="/content/:id"
          element={session ? <ContentDetail /> : <Navigate to="/login" />}
        />
        <Route
          path="/settings"
          element={session ? <Settings /> : <Navigate to="/login" />}
        />
        <Route
          path="/marketplace"
          element={session ? <Marketplace /> : <Navigate to="/login" />}
        />
        <Route
          path="/editor"
          element={session ? <EditorPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/integrations"
          element={session ? <Integrations /> : <Navigate to="/login" />}
        />
        <Route
          path="/metrics"
          element={session ? <Metrics /> : <Navigate to="/login" />}
        />
        <Route
          path="/copilot"
          element={session ? <AICopilot /> : <Navigate to="/login" />}
        />
        <Route
          path="*"
          element={<Navigate to={session ? "/dashboard" : "/"} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
