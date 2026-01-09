
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BusinessLead, SearchQuery, User } from './types';
import { BUSINESS_CATEGORIES, INDIA_CITIES } from './constants';
import { findBusinessLeads, calculateDistance } from './services/businessService';
import { exportToCSV, exportToPDF } from './services/exportService';
import LeadTable from './components/LeadTable';
import MapView from './components/MapView';
import SearchModal from './components/SearchModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authForm, setAuthForm] = useState({ name: '', email: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [simulatedLeads, setSimulatedLeads] = useState(0);
  const [tickerMessage, setTickerMessage] = useState('Initializing search...');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [lastQuery, setLastQuery] = useState<{ city: string; categories: string[] } | null>(null);
  
  const tickerIntervalRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const checkKeyStatus = async () => {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasCustomKey(hasKey);
      }
    };
    checkKeyStatus();

    const savedUser = localStorage.getItem('easylead_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location access denied", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (loading) {
      setProgress(0);
      setSimulatedLeads(0);
      const messages = [
        "Connecting to Search Grounding API...",
        "Identifying physical locations...",
        "Verifying official contact profiles...",
        "Finalizing verified lead list..."
      ];
      tickerIntervalRef.current = window.setInterval(() => {
        setTickerMessage(messages[Math.floor(Math.random() * messages.length)]);
      }, 1500);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => (prev >= 98 ? prev : prev + (prev < 50 ? 1.5 : 0.8)));
        setSimulatedLeads(prev => (prev >= 12 ? prev : Math.random() > 0.8 ? prev + 1 : prev));
      }, 200);
    } else {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [loading]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!authForm.name || !authForm.email) return;
    if (!authForm.email.toLowerCase().endsWith('@gmail.com')) {
      setLoginError("Access Restricted: Only @gmail.com addresses are permitted.");
      return;
    }
    const newUser = { name: authForm.name, email: authForm.email.toLowerCase() };
    setUser(newUser);
    localStorage.setItem('easylead_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('easylead_user');
    setAuthForm({ name: '', email: '' });
    setLoginError(null);
  };

  const handleSelectApiKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setQuotaExceeded(false);
      setError(null);
      setHasCustomKey(true);
    } catch (e) {
      console.error("Key selection failed", e);
    }
  };

  const performSearch = useCallback(async (searchCity: string, searchCategories: string[], searchRadius: number) => {
    setLoading(true);
    setQuotaExceeded(false);
    setIsSearchModalOpen(false);
    setError(null);
    setLeads([]); 
    setLastQuery({ city: searchCity, categories: searchCategories });
    
    try {
      const results = await findBusinessLeads({ city: searchCity, categories: searchCategories, radius: searchRadius }, userCoords || undefined);
      
      const processed = results.map(lead => {
        if (userCoords && lead.lat && lead.lng) {
          return { ...lead, distance: calculateDistance(userCoords.lat, userCoords.lng, lead.lat, lead.lng) };
        }
        return lead;
      });
      
      setProgress(100);
      setSimulatedLeads(processed.length);
      
      setTimeout(() => {
        setLeads(processed);
        setLoading(false);
        if (processed.length === 0) {
          setError(`No verified businesses found for "${searchCategories.join(", ")}" in ${searchCity}. Try searching for a broader category.`);
        }
      }, 500);
    } catch (err: any) {
      console.error("Lead Generation Failed:", err);
      setLoading(false);
      if (err.message === "QUOTA_EXCEEDED") {
        setQuotaExceeded(true);
      } else {
        setError(err.message || "An unexpected error occurred. Please try again.");
      }
    }
  }, [userCoords]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-violet-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>

        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl z-10 relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center bg-indigo-600 w-16 h-16 rounded-3xl shadow-2xl shadow-indigo-600/30 mb-8">
              <i className="fa-solid fa-bolt text-white text-3xl"></i>
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tight">EasyLead</h1>
            <p className="text-slate-400 font-medium">Professional Lead Generation Tool</p>
          </div>

          {loginError && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3 text-rose-500">
                <i className="fa-solid fa-circle-exclamation text-sm"></i>
                <p className="text-[11px] font-black uppercase tracking-wider">{loginError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Full Name</label>
              <input 
                type="text" 
                required 
                value={authForm.name} 
                onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                placeholder="Rahul Sharma" 
                className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Work Email</label>
              <input 
                type="email" 
                required 
                value={authForm.email} 
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                placeholder="rahul@gmail.com" 
                className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
              />
            </div>

            <button 
              type="submit" 
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-indigo-600/20 active:scale-[0.98] mt-4"
            >
              Get Started
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-900 sticky top-0 z-40 px-6 md:px-12 py-5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-indigo-600 w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <i className="fa-solid fa-bolt text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none mb-1">EasyLead</h1>
              <p className="text-[9px] text-slate-500 font-bold tracking-[0.2em] uppercase">Flash Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="flex items-center gap-2.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              <i className="fa-solid fa-plus text-xs"></i>
              <span>Search Leads</span>
            </button>
            <button 
                onClick={handleLogout}
                className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 md:p-12 space-y-10">
        {loading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-full max-w-2xl bg-slate-900/50 border border-slate-800/50 p-12 rounded-[3rem] text-center shadow-3xl flex flex-col items-center gap-8 animate-pulse">
              <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="space-y-4">
                <h3 className="text-4xl font-black text-white tracking-tight">Searching Leads...</h3>
                <p className="text-slate-400 font-medium italic">{tickerMessage}</p>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden mt-6">
                  <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="flex justify-between w-full text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  <span>Powering Search Grounding</span>
                  <span>{Math.round(progress)}% Complete</span>
                </div>
              </div>
            </div>
          </div>
        ) : quotaExceeded ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-12 bg-indigo-600/5 border border-indigo-500/20 rounded-[3rem] shadow-2xl">
              <div className="w-24 h-24 bg-rose-600/20 border border-rose-500/40 rounded-3xl flex items-center justify-center mb-8">
                <i className="fa-solid fa-triangle-exclamation text-rose-500 text-4xl"></i>
              </div>
              <h3 className="text-3xl font-black text-white mb-4">API Key Limit Reached</h3>
              <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
                The current API key has no remaining quota or hasn't enabled the Generative AI API. To continue searching, please provide your own <b>Paid API Key</b>.
              </p>
              
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-left max-w-lg mx-auto mb-10 space-y-4">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-lightbulb"></i> How to solve this immediately:
                </h4>
                <div className="text-xs text-slate-400 space-y-3 font-medium">
                  <p>1. Go to <a href="https://aistudio.google.com" target="_blank" className="text-indigo-400 underline">AI Studio</a>.</p>
                  <p>2. Create an API Key in a project with <b>Billing Enabled</b>.</p>
                  <p>3. Click <b>"Use My Own API Key"</b> below and select it.</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleSelectApiKey}
                  className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/30 flex items-center gap-3"
                >
                  <i className="fa-solid fa-key"></i> Use My Own API Key
                </button>
                <button 
                  onClick={() => { setQuotaExceeded(false); setError(null); }}
                  className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black transition-all"
                >
                  Try Again Later
                </button>
              </div>
          </div>
        ) : error ? (
           <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-10 bg-slate-900/30 border border-slate-800/50 rounded-[3rem]">
              <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center justify-center mb-8">
                <i className="fa-solid fa-circle-xmark text-rose-500 text-3xl"></i>
              </div>
              <h3 className="text-2xl font-black text-white mb-4">Search Unsuccessful</h3>
              <p className="text-slate-400 mb-10 max-w-lg mx-auto leading-relaxed">{error}</p>
              <button 
                onClick={() => setIsSearchModalOpen(true)} 
                className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all"
              >
                Refine Search
              </button>
           </div>
        ) : leads.length > 0 ? (
          <div className="w-full space-y-10 animate-in fade-in duration-700">
            <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white">Results for <span className="text-indigo-500">{lastQuery?.categories.join(", ")}</span></h2>
                <p className="text-slate-500 font-medium">Verified {leads.length} leads in {lastQuery?.city}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setViewMode('table')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500'}`}>Table View</button>
                <button onClick={() => setViewMode('map')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500'}`}>Map View</button>
                <button onClick={() => exportToCSV(leads)} className="px-5 py-2.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl text-xs font-bold hover:text-white transition-colors">Export .CSV</button>
              </div>
            </div>
            
            <div className="transition-all duration-500">
              {viewMode === 'table' ? <LeadTable leads={leads} /> : <MapView leads={leads} userCoords={userCoords} />}
            </div>
          </div>
        ) : (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center mb-10 border border-slate-800 shadow-2xl">
              <i className="fa-solid fa-bolt text-indigo-500 text-4xl"></i>
            </div>
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Verified Indian Leads</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-10 text-lg font-medium">Harness Gemini Flash Grounding to find accurate business data across 100+ cities.</p>
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-indigo-600/30 active:scale-95"
            >
              Start New Search
            </button>
            {hasCustomKey && (
              <p className="mt-8 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-4 py-2 rounded-xl">
                <i className="fa-solid fa-check-circle mr-2"></i> Custom API Key Active
              </p>
            )}
          </div>
        )}
      </main>

      <footer className="bg-slate-950 border-t border-slate-900 py-10 px-6 text-center text-slate-700 text-[10px] font-black uppercase tracking-widest mt-auto">
        <p>© 2024 EasyLead Intelligence | High-Performance Search Grounding</p>
      </footer>

      <SearchModal 
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
        onSearch={performSearch}
      />
    </div>
  );
};

export default App;
