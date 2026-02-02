import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Zap, Search, Bell, LogOut, ChevronDown, Database } from 'lucide-react';
import { useSearch } from '../contexts/SearchContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { searchTerm, setSearchTerm } = useSearch();
  const { currentUser, availableUsers, login } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Pipeline', path: '/' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">B</span>
            BrokerOS
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-brand-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Admin Tools Section */}
          {currentUser.role === UserRole.ADMIN && (
              <>
                <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Admin Tools
                </div>
                <Link
                    to="/admin/db"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === '/admin/db'
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                    <Database size={20} />
                    <span className="font-medium">Database</span>
                </Link>
              </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
            <div className="relative group">
                <button className="flex items-center gap-3 w-full text-left p-2 rounded hover:bg-slate-800 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        currentUser.role === UserRole.ADMIN ? 'bg-purple-500' : 
                        currentUser.role === UserRole.PROCESSOR ? 'bg-amber-500' : 'bg-brand-500'
                    }`}>
                        {currentUser.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{currentUser.role}</p>
                    </div>
                    <ChevronDown size={14} className="text-slate-500" />
                </button>

                {/* User Switcher Dropdown (Simulated Auth) */}
                <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden hidden group-hover:block">
                    <div className="p-2 text-xs text-slate-500 uppercase font-bold tracking-wider border-b border-slate-700 mb-1">Switch User</div>
                    {availableUsers.map(u => (
                        <button
                            key={u.id}
                            onClick={() => login(u.id)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 ${u.id === currentUser.id ? 'text-white font-bold' : 'text-slate-400'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${u.role === UserRole.ADMIN ? 'bg-purple-500' : u.role === UserRole.PROCESSOR ? 'bg-amber-500' : 'bg-brand-500'}`}></div>
                            {u.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
            <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search leads, phones, or status..." 
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-md focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-sm"
                />
            </div>
            <div className="flex items-center gap-4">
                <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>
            </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto bg-slate-50">
            {children}
        </div>
      </main>
    </div>
  );
};