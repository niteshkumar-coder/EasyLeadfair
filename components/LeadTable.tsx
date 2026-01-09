
import React, { useState, useMemo } from 'react';
import { BusinessLead } from '../types';

interface LeadTableProps {
  leads: BusinessLead[];
}

const LeadTable: React.FC<LeadTableProps> = ({ leads }) => {
  const [sortKey, setSortKey] = useState<keyof BusinessLead>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortedLeads = useMemo(() => {
    if (!Array.isArray(leads)) return [];
    return [...leads].sort((a, b) => {
      const valA = a[sortKey] ?? 0;
      const valB = b[sortKey] ?? 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA || "").toLowerCase();
      const strB = String(valB || "").toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [leads, sortKey, sortOrder]);

  const toggleSort = (key: keyof BusinessLead) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const getDistanceColor = (dist: number) => {
    if (dist < 2) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (dist < 10) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-emerald-400';
    if (rating >= 4.0) return 'text-indigo-400';
    if (rating >= 3.0) return 'text-amber-400';
    return 'text-rose-400';
  };

  const isValueValid = (val: string | null): boolean => {
    if (!val) return false;
    const v = String(val).trim().toLowerCase();
    const invalidKeywords = ['null', 'na', 'n/a', 'none', 'undefined', 'not available', 'missing', 'hidden', 'private', 'no number', 'unknown'];
    if (invalidKeywords.some(k => v === k || v.includes(k))) return false;
    return v.length > 5; // Real contact info/emails are generally > 5 chars
  };

  const isPhoneValid = (phone: string | null): boolean => {
    if (!isValueValid(phone)) return false;
    const digits = String(phone).replace(/[^0-9]/g, '');
    const isRepeating = /^(.)\1+$/.test(digits);
    // Verified Indian numbers are typically 10-12 digits including country code
    return digits.length >= 8 && digits.length <= 15 && !isRepeating;
  };

  const sanitizePhoneForLink = (phone: any) => {
    return String(phone || "").replace(/[^0-9+]/g, '');
  };

  const ensureHttp = (url: string) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-sm rounded-[2rem] border border-slate-800/60 flex flex-col max-h-[750px] relative overflow-hidden shadow-2xl">
      <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1300px]">
          <thead className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl">
            <tr className="border-b border-slate-800">
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center w-16">#</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('name')}>
                <div className="flex items-center gap-2">
                  Business Entity {sortKey === 'name' && (sortOrder === 'asc' ? <i className="fa-solid fa-sort-up"></i> : <i className="fa-solid fa-sort-down"></i>)}
                </div>
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('rating')}>
                 <div className="flex items-center gap-2">
                  Rank {sortKey === 'rating' && (sortOrder === 'asc' ? <i className="fa-solid fa-sort-up"></i> : <i className="fa-solid fa-sort-down"></i>)}
                </div>
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('distance')}>
                 <div className="flex items-center gap-2">
                  Proximity {sortKey === 'distance' && (sortOrder === 'asc' ? <i className="fa-solid fa-sort-up"></i> : <i className="fa-solid fa-sort-down"></i>)}
                </div>
              </th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Primary Contact</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Official Email</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Website Asset</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Action</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Full Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {sortedLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-40 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 bg-slate-950 rounded-[2rem] border border-slate-800 flex items-center justify-center">
                      <i className="fa-solid fa-box-open text-slate-700 text-3xl"></i>
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-400 text-lg">No leads currently populated</p>
                      <p className="text-slate-600 text-sm font-medium">Configure a search to start gathering business intelligence.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedLeads.map((lead, idx) => {
                const hasValidPhone = isPhoneValid(lead.phone);
                const hasValidEmail = isValueValid(lead.email);
                const hasValidWebsite = isValueValid(lead.website);

                return (
                  <tr key={lead.id || idx} className="hover:bg-indigo-500/5 transition-all group border-b border-transparent hover:border-indigo-500/20">
                    <td className="px-6 py-5 text-sm text-slate-600 font-black text-center">{idx + 1}</td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col max-w-[280px]">
                        <span className="text-sm font-black text-white truncate group-hover:text-indigo-400 transition-colors" title={lead.name}>{lead.name}</span>
                        <span className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter truncate mt-0.5">{lead.source} Grounded</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {lead.rating ? (
                        <div className={`flex items-center gap-2 font-black ${getRatingColor(lead.rating)}`}>
                          <i className="fa-solid fa-star text-[10px]"></i>
                          <span className="text-sm">{Number(lead.rating).toFixed(1)}</span>
                          {lead.userRatingsTotal && <span className="text-[9px] text-slate-600 font-bold">({lead.userRatingsTotal})</span>}
                        </div>
                      ) : (
                        <span className="text-slate-700 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-slate-800 rounded">NA</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {lead.distance !== null ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black border ${getDistanceColor(lead.distance)}`}>
                          <i className="fa-solid fa-location-arrow mr-1.5 opacity-50"></i>
                          {Number(lead.distance).toFixed(1)} km
                        </span>
                      ) : (
                        <span className="text-slate-700 italic text-[10px] font-bold">Syncing...</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {hasValidPhone ? (
                        <a href={`tel:${sanitizePhoneForLink(lead.phone)}`} className="text-indigo-400 font-black hover:text-indigo-300 transition-colors text-sm flex items-center gap-2 whitespace-nowrap group/link">
                          <i className="fa-solid fa-square-phone text-indigo-500/50 group-hover/link:text-indigo-400"></i>
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-800/40 px-3 py-1 rounded-lg border border-slate-800/50">NA</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {hasValidEmail ? (
                        <a href={`mailto:${lead.email}`} className="text-indigo-400 font-black hover:text-indigo-300 transition-colors text-xs flex items-center gap-2 max-w-[180px] truncate" title={lead.email || ''}>
                          <i className="fa-solid fa-envelope-circle-check text-indigo-500/50"></i>
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-800/40 px-3 py-1 rounded-lg border border-slate-800/50">NA</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {hasValidWebsite ? (
                        <a href={ensureHttp(lead.website || '')} target="_blank" rel="noopener noreferrer" className="text-slate-400 font-black hover:text-white transition-colors text-[11px] flex items-center gap-2 max-w-[180px] truncate underline decoration-slate-800 underline-offset-4" title={lead.website || ''}>
                          <i className="fa-solid fa-link text-slate-700"></i>
                          {lead.website?.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-800/40 px-3 py-1 rounded-lg border border-slate-800/50">NA</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-map-pin"></i> Profile
                      </a>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-slate-600 text-[11px] font-medium max-w-[250px] truncate group-hover:text-slate-400 transition-colors" title={lead.address}>
                        {lead.address}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default LeadTable;
