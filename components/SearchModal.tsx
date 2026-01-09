
import React, { useState, useRef, useEffect } from 'react';
import { BUSINESS_CATEGORIES, INDIA_CITIES } from '../constants';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (city: string, categories: string[], radius: number) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSearch }) => {
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(25);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [isCityFocused, setIsCityFocused] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setIsCityFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const filteredCities = INDIA_CITIES.filter(c => 
    c.toLowerCase().includes(citySearch.toLowerCase())
  ).slice(0, 8);

  const filteredCategories = BUSINESS_CATEGORIES.filter(cat => 
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) return alert("Please select a city.");
    if (selectedCategories.length === 0) return alert("Select at least one category.");
    onSearch(city, selectedCategories, radius);
  };

  const selectCity = (c: string) => {
    setCity(c);
    setCitySearch(c);
    setIsCityFocused(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      <div 
        ref={modalRef}
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-500"
      >
        {/* Modal Header */}
        <div className="px-10 py-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">Configure New Search</h2>
            <p className="text-slate-500 text-sm mt-1 font-medium italic">Gemini will search across multiple sources for verified data.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-2xl hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-white transition-all"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-10 overflow-y-auto custom-scrollbar">
          <form id="search-form" onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            <div className="space-y-10">
              {/* City Selection */}
              <div className="space-y-4" ref={cityRef}>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                  <i className="fa-solid fa-location-dot text-indigo-500"></i> Target City
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Type city name..."
                    value={citySearch}
                    onChange={(e) => {
                      setCitySearch(e.target.value);
                      setIsCityFocused(true);
                    }}
                    onFocus={() => setIsCityFocused(true)}
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-6 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-bold placeholder:text-slate-600"
                  />
                  {isCityFocused && citySearch.length > 0 && filteredCities.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in slide-in-from-top-2">
                      {filteredCities.map(c => (
                        <button 
                          key={c}
                          type="button"
                          onClick={() => selectCity(c)}
                          className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors flex items-center justify-between group"
                        >
                          {c}
                          <i className="fa-solid fa-arrow-right text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {city && (
                  <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold px-2">
                    <i className="fa-solid fa-check-circle"></i> Targeted: {city}
                  </div>
                )}
              </div>

              {/* Radius Slider */}
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-1">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    <i className="fa-solid fa-bullseye text-indigo-500"></i> Search Radius
                  </label>
                  <span className="text-xl font-black text-indigo-500">{radius}<span className="text-xs ml-0.5 opacity-50">km</span></span>
                </div>
                <div className="relative h-2 bg-slate-800 rounded-full flex items-center px-1">
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    step="5"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full h-full appearance-none bg-transparent cursor-pointer accent-indigo-500"
                  />
                </div>
                <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase tracking-widest px-1">
                  <span>5 km</span>
                  <span>50 km</span>
                  <span>100 km</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                <i className="fa-solid fa-tags text-indigo-500"></i> Business Categories
              </label>
              <div className="bg-slate-800/30 border border-slate-800 rounded-3xl p-5 flex flex-col h-[350px]">
                <div className="relative mb-5">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  <input 
                    type="text" 
                    placeholder="Filter categories..." 
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-2">
                  {filteredCategories.map(cat => (
                    <label 
                      key={cat} 
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${selectedCategories.includes(cat) ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-slate-900/50 border-transparent hover:border-slate-700'}`}
                    >
                      <span className={`text-xs font-bold transition-colors ${selectedCategories.includes(cat) ? 'text-indigo-400' : 'text-slate-400'}`}>{cat}</span>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={selectedCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                      />
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedCategories.includes(cat) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-800'}`}>
                        {selectedCategories.includes(cat) && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                      </div>
                    </label>
                  ))}
                  {filteredCategories.length === 0 && (
                    <p className="text-center text-slate-600 text-[10px] font-bold py-10">No categories matching "{categorySearch}"</p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{selectedCategories.length} Selected</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedCategories([])}
                    className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-10 py-8 bg-slate-950/50 border-t border-slate-800 flex items-center justify-end gap-5">
          <button 
            type="button" 
            onClick={onClose}
            className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl font-black text-sm transition-all"
          >
            Cancel
          </button>
          <button 
            form="search-form"
            type="submit"
            className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm transition-all shadow-2xl shadow-indigo-600/30 flex items-center gap-3 active:scale-95 disabled:opacity-50"
            disabled={!city || selectedCategories.length === 0}
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            Initialize Lead Generation
          </button>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default SearchModal;
