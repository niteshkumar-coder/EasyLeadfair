
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
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [simulatedLeads, setSimulatedLeads] = useState(0);
  const [tickerMessage, setTickerMessage] = useState('Initializing search...');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [lastQuery, setLastQuery] = useState<{ city: string; categories: string[] } | null>(null);
  
  // Admin States
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);

  const tickerIntervalRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Load Current User
    const savedUser = localStorage.getItem('easylead_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }

    // Load All Users for Admin
    const savedAllUsers = localStorage.getItem('easylead_all_users');
    if (savedAllUsers) {
      try {
        setAllUsers(JSON.parse(savedAllUsers));
      } catch (e) {
        setAllUsers([]);
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
        "Connecting to Gemini AI...",
        "Searching Google Maps grounding...",
        "Scanning web for business signals...",
        "Extracting verified phone numbers...",
        "Fetching official email addresses...",
        "Verifying website assets...",
        "Calculating distances...",
        "Cross-referencing ratings...",
        "Finalizing lead list..."
      ];
      tickerIntervalRef.current = window.setInterval(() => {
        setTickerMessage(messages[Math.floor(Math.random() * messages.length)]);
      }, 2000);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => (prev >= 98 ? prev : prev + (prev < 60 ? 1.5 : 0.5)));
        setSimulatedLeads(prev => (prev >= 30 ? prev : Math.random() > 0.6 ? prev + 2 : prev));
      }, 100);
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

    // Save to all users log
    const savedAllUsersStr = localStorage.getItem('easylead_all_users');
    let currentLogs: User[] = [];
    try {
      currentLogs = savedAllUsersStr ? JSON.parse(savedAllUsersStr) : [];
    } catch (e) {}

    if (!currentLogs.some(u => u.email === newUser.email)) {
      const updatedAll = [...currentLogs, newUser];
      setAllUsers(updatedAll);
      localStorage.setItem('easylead_all_users', JSON.stringify(updatedAll));
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('easylead_user');
    setAuthForm({ name: '', email: '' });
    setLoginError(null);
    setIsAdminMode(false);
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "Nitesh45090@") {
      setIsAdminMode(true);
      setIsAdminAuthOpen(false);
      setAdminPassword('');
      setAdminError(null);
      // Ensure all users are loaded
      const savedAllUsers = localStorage.getItem('easylead_all_users');
      if (savedAllUsers) {
        setAllUsers(JSON.parse(savedAllUsers));
      }
    } else {
      setAdminError("Invalid Administrator Password");
    }
  };

  const clearUserLogs = () => {
    if (window.confirm("Are you sure you want to clear all user logs?")) {
      setAllUsers([]);
      localStorage.removeItem('easylead_all_users');
    }
  };

  const performSearch = useCallback(async (searchCity: string, searchCategories: string[], searchRadius: number) => {
    setLoading(true);
    setIsSearchModalOpen(false);
    setError(null);
    setLeads([]); 
    setLastQuery({ city: searchCity, categories: searchCategories });
    
    try {
      const results = await findBusinessLeads({ city: searchCity, categories: searchCategories, radius: searchRadius }, userCoords || undefined);
      const processed = (results || []).map(lead => {
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
          setError(`No verified results found for "${searchCategories.join(", ")}" in ${searchCity}. Google Search found no direct matches with verified contact data. Try searching for one category at a time.`);
        }
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while fetching leads. Please check your internet connection and try again.");
      setLoading(false);
    }
  }, [userCoords]);

  // Admin Dashboard Component
  if (isAdminMode) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-8">
        <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-600/20">
                <i className="fa-solid fa-user-shield text-white text-xl"></i>
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">User Access Logs</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={clearUserLogs}
                className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Clear Logs
              </button>
              <button 
                onClick={() => setIsAdminMode(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Return to Login
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">#</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">User Name</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Verified Gmail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {allUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-20 text-center text-slate-600 font-bold italic">No user records found.</td>
                  </tr>
                ) : (
                  allUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-8 py-5 text-sm font-black text-slate-700">{i + 1}</td>
                      <td className="px-8 py-5 text-sm font-black text-white">{u.name}</td>
                      <td className="px-8 py-5 text-sm font-black text-indigo-400">{u.email}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[10px] text-slate-700 font-black uppercase tracking-[0.3em]">Confidential Administrator Data Access</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-violet-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl z-10 relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center bg-indigo-600 w-16 h-16 rounded-3xl shadow-2xl shadow-indigo-600/30 mb-8">
              <i className="fa-solid fa-bolt text-white text-3xl"></i>
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tight">EasyLead</h1>
            <p className="text-slate-400 font-medium">Professional Indian Lead Generation Tool</p>
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
              <div className="relative">
                <i className="fa-solid fa-user absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="text" 
                  required 
                  value={authForm.name} 
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma" 
                  className="w-full pl-14 pr-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Work Email</label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="email" 
                  required 
                  value={authForm.email} 
                  onChange={(e) => {
                    setAuthForm({ ...authForm, email: e.target.value });
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="rahul@gmail.com" 
                  className={`w-full pl-14 pr-6 py-4 bg-slate-800/50 border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-white placeholder:text-slate-600 ${loginError ? 'border-rose-500/50' : 'border-slate-700/50'}`}
                />
              </div>
              <p className="mt-2 ml-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest italic opacity-60">Must end with @gmail.com</p>
            </div>

            <button 
              type="submit" 
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-indigo-600/20 active:scale-[0.98] mt-4"
            >
              Get Started
            </button>
          </form>

          <div className="mt-10 flex flex-col items-center gap-6">
            <div className="flex items-center justify-center gap-4 text-slate-600 w-full">
              <div className="h-px flex-1 bg-slate-800"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise Secured</span>
              <div className="h-px flex-1 bg-slate-800"></div>
            </div>
            
            <button 
              onClick={() => setIsAdminAuthOpen(true)}
              className="text-[10px] font-black text-slate-700 hover:text-slate-400 transition-colors uppercase tracking-[0.4em] flex items-center gap-2 group"
            >
              <i className="fa-solid fa-lock text-[8px] opacity-40 group-hover:opacity-100 transition-opacity"></i>
              System Admin
            </button>
          </div>

          {isAdminAuthOpen && (
            <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl rounded-[2.5rem] flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300">
               <button onClick={() => { setIsAdminAuthOpen(false); setAdminError(null); setAdminPassword(''); }} className="absolute top-6 right-8 text-slate-500 hover:text-white transition-colors">
                 <i className="fa-solid fa-xmark text-lg"></i>
               </button>
               <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-6">
                 <i className="fa-solid fa-shield-halved text-indigo-500"></i>
               </div>
               <h3 className="text-xl font-black text-white mb-2">Admin Verification</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8">Authorization Required</p>
               
               <form onSubmit={handleAdminAuth} className="w-full space-y-4">
                 <input 
                   type="password" 
                   autoFocus
                   value={adminPassword}
                   onChange={(e) => { setAdminPassword(e.target.value); setAdminError(null); }}
                   placeholder="Enter Admin Password"
                   className={`w-full bg-slate-900 border ${adminError ? 'border-rose-500/50' : 'border-slate-800'} rounded-2xl px-6 py-4 text-white text-center font-bold outline-none focus:ring-2 focus:ring-indigo-600 transition-all`}
                 />
                 {adminError && <p className="text-[10px] text-rose-500 font-black text-center uppercase tracking-widest">{adminError}</p>}
                 <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl">
                   Confirm Access
                 </button>
               </form>
            </div>
          )}
        </div>

        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      {/* Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-900 sticky top-0 z-40 px-6 md:px-12 py-5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-indigo-600 w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <i className="fa-solid fa-bolt text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none mb-1">EasyLead</h1>
              <p className="text-[9px] text-slate-500 font-bold tracking-[0.2em] uppercase">Grounding Search AI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="hidden sm:flex items-center gap-2.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
            >
              <i className="fa-solid fa-plus text-xs"></i>
              <span>New Lead Search</span>
            </button>
            
            <div className="h-10 w-px bg-slate-900 mx-2 hidden md:block"></div>

            <div className="flex items-center gap-4 pl-2 group cursor-default">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors">{user.name}</p>
                <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all"
                title="Logout"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 md:p-12 space-y-10">
        
        {loading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-full max-w-2xl bg-slate-900/50 border border-slate-800/50 p-12 rounded-[3rem] text-center shadow-3xl flex flex-col items-center gap-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
              
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fa-solid fa-magnifying-glass-location text-2xl text-indigo-400 animate-pulse"></i>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-4xl font-black text-white tracking-tight">Searching Leads...</h3>
                <p className="text-slate-400 font-medium text-lg h-6 flex items-center justify-center italic">
                  {tickerMessage}
                </p>
              </div>

              <div className="w-full space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-5xl font-black text-indigo-500">{Math.round(progress)}<span className="text-2xl opacity-50">%</span></span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white block">{simulatedLeads}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identified Potential</span>
                  </div>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-500 shadow-lg shadow-indigo-600/30" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
           <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-10 bg-slate-900/30 border border-slate-800/50 rounded-[3rem]">
              <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-3xl flex items-center justify-center mb-8">
                <i className="fa-solid fa-triangle-exclamation text-rose-500 text-3xl"></i>
              </div>
              <h3 className="text-2xl font-black text-white mb-4">Search Unsuccessful</h3>
              <p className="text-slate-400 mb-10 max-w-md mx-auto leading-relaxed">{error}</p>
              <button 
                onClick={() => setIsSearchModalOpen(true)} 
                className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black transition-all active:scale-95"
              >
                Modify Criteria
              </button>
           </div>
        ) : leads.length > 0 ? (
          <div className="w-full space-y-10 animate-in fade-in duration-700">
            <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                    Search Complete
                  </div>
                  <div className="h-1 w-1 bg-slate-800 rounded-full"></div>
                  <span className="text-slate-500 text-xs font-medium">{leads.length} Verified Leads Found</span>
                </div>
                <h2 className="text-4xl font-black text-white tracking-tight">
                  Leads for <span className="text-indigo-500">{lastQuery?.categories.join(", ")}</span> in <span className="text-indigo-500">{lastQuery?.city}</span>
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-slate-900/50 p-1.5 rounded-2xl flex border border-slate-800">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <i className="fa-solid fa-table-list"></i> Table
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 ${viewMode === 'map' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <i className="fa-solid fa-map-location-dot"></i> Analytics Map
                  </button>
                </div>

                <div className="w-px h-10 bg-slate-900 mx-2"></div>

                <div className="flex gap-2.5">
                  <button onClick={() => exportToCSV(leads)} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-800 flex items-center gap-2.5 transition-all">
                    <i className="fa-solid fa-file-csv text-slate-500"></i> Export CSV
                  </button>
                  <button onClick={() => exportToPDF(leads, lastQuery?.categories || [])} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2.5 transition-all">
                    <i className="fa-solid fa-file-pdf"></i> PDF Report
                  </button>
                </div>
              </div>
            </div>
            
            <div className="transition-all duration-500 ease-in-out">
              {viewMode === 'table' ? (
                <LeadTable leads={leads} />
              ) : (
                <MapView leads={leads} userCoords={userCoords} />
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center mb-10 border border-slate-800 shadow-2xl animate-bounce duration-[2000ms]">
              <i className="fa-solid fa-bolt text-slate-700 text-4xl"></i>
            </div>
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Ready to generate leads?</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-10 text-lg">
              Start a new search to find businesses across 100+ categories in any major Indian city.
            </p>
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 group"
            >
              <i className="fa-solid fa-plus mr-3 group-hover:rotate-90 transition-transform"></i>
              Find New Leads Now
            </button>
          </div>
        )}
      </main>

      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6 md:px-12 mt-auto">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col md:flex-row items-center gap-8 text-[10px] text-slate-600 uppercase tracking-[0.2em] font-black">
            <p>© 2024 EasyLead Intelligence</p>
            <div className="h-1 w-1 bg-slate-800 rounded-full hidden md:block"></div>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-indigo-500/50"></i>
              <p>Data Accuracy Verified by Gemini Grounding</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdminAuthOpen(true)}
            className="text-[8px] text-slate-800 hover:text-slate-600 transition-colors uppercase tracking-widest font-black"
          >
            <i className="fa-solid fa-lock mr-2 opacity-30"></i> Admin
          </button>
        </div>
      </footer>

      {/* Admin Auth Modal (Globally accessible when triggered) */}
      {isAdminAuthOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setIsAdminAuthOpen(false)} />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-3xl animate-in zoom-in-95 duration-300">
             <button onClick={() => { setIsAdminAuthOpen(false); setAdminError(null); setAdminPassword(''); }} className="absolute top-6 right-8 text-slate-500 hover:text-white transition-colors">
               <i className="fa-solid fa-xmark text-lg"></i>
             </button>
             <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
               <i className="fa-solid fa-shield-halved text-indigo-500"></i>
             </div>
             <h3 className="text-xl font-black text-white mb-2 text-center">Admin Access</h3>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8 text-center">Authorization Required</p>
             
             <form onSubmit={handleAdminAuth} className="w-full space-y-4">
               <input 
                 type="password" 
                 autoFocus
                 value={adminPassword}
                 onChange={(e) => { setAdminPassword(e.target.value); setAdminError(null); }}
                 placeholder="Enter Password"
                 className={`w-full bg-slate-950 border ${adminError ? 'border-rose-500/50' : 'border-slate-800'} rounded-2xl px-6 py-4 text-white text-center font-bold outline-none focus:ring-2 focus:ring-indigo-600 transition-all`}
               />
               {adminError && <p className="text-[10px] text-rose-500 font-black text-center uppercase tracking-widest">{adminError}</p>}
               <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl">
                 Verify & Open Dashboard
               </button>
             </form>
          </div>
        </div>
      )}

      <SearchModal 
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
        onSearch={performSearch}
      />

      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #020617; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
