import React, { useState, useEffect } from 'react';
import { Database, Download, RefreshCcw, AlertTriangle, Code, Copy, Check } from 'lucide-react';
import { getFullDatabase, resetDatabase } from '../services/storage';

export const DatabaseView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'leads' | 'touches' | 'users'>('leads');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setData(getFullDatabase());
  };

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brokeros-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (window.confirm('WARNING: This will delete ALL data and restore the seed data. This cannot be undone. Are you sure?')) {
        resetDatabase();
    }
  };

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data[activeTab], null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) return <div className="p-10">Loading DB...</div>;

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
        <div className="flex justify-between items-start mb-6 shrink-0">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Database className="text-brand-600" /> Database Manager
                </h1>
                <p className="text-slate-500 mt-1">Direct access to the application's local backend storage.</p>
            </div>
            <div className="flex gap-3">
                 <button 
                    onClick={refreshData}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                    <RefreshCcw size={16} /> Refresh
                </button>
                <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 rounded-lg text-white font-bold hover:bg-brand-700 transition-colors shadow-sm"
                >
                    <Download size={16} /> Backup JSON
                </button>
                <button 
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-200 rounded-lg text-red-700 font-bold hover:bg-red-200 transition-colors"
                >
                    <AlertTriangle size={16} /> Factory Reset
                </button>
            </div>
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-200">
                {(['leads', 'touches', 'users'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === tab ? 'border-brand-500 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        {tab} <span className="ml-2 bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-xs">{data[tab].length}</span>
                    </button>
                ))}
            </div>
            
            <div className="relative flex-1 bg-slate-900 overflow-hidden">
                 <div className="absolute top-4 right-4 z-10">
                     <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 text-xs font-bold transition-all"
                     >
                         {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                         {copied ? 'Copied' : 'Copy JSON'}
                     </button>
                 </div>
                <pre className="p-6 overflow-auto h-full text-xs font-mono text-green-400 leading-relaxed custom-scrollbar">
                    {JSON.stringify(data[activeTab], null, 2)}
                </pre>
            </div>
        </div>
        
        <div className="mt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Code size={12} />
            <span>Backend Storage ID: {window.location.origin} (localStorage)</span>
        </div>
    </div>
  );
};