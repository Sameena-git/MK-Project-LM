import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Phone, Clock, DollarSign, AlertCircle, AlertTriangle, ArrowRight, UserPlus, Archive, Filter, X, Check, Trash2, Users, MessageSquare, Send, Mail, MessageCircle, Save } from 'lucide-react';
import { getLeads, createLead, findDuplicateLead, saveLead, addTouch } from '../services/storage';
import { Lead, LeadStatus, Borrower, UserRole, TouchType, TouchOutcome } from '../types';
import { useSearch } from '../contexts/SearchContext';
import { useAuth } from '../contexts/AuthContext';

interface StageGroup {
    id: string;
    label: string;
    statuses: LeadStatus[];
    colorClass: string;
    description: string;
}

const STAGE_GROUPS: StageGroup[] = [
    { 
        id: 'new', 
        label: 'New', 
        statuses: [LeadStatus.NEW], 
        colorClass: 'bg-blue-50 border-blue-200 text-blue-700',
        description: 'Fresh leads needing outreach'
    },
    { 
        id: 'attempted', 
        label: 'Attempted', 
        statuses: [LeadStatus.ATTEMPTED_CONTACT], 
        colorClass: 'bg-amber-50 border-amber-200 text-amber-700',
        description: 'Outreach made, no contact yet'
    },
    { 
        id: 'talking', 
        label: 'Talking', 
        statuses: [LeadStatus.IN_COMMUNICATION], 
        colorClass: 'bg-purple-50 border-purple-200 text-purple-700',
        description: 'Active conversation in progress'
    },
    { 
        id: 'processing', 
        label: 'Processing', 
        statuses: [LeadStatus.PROCESSING, LeadStatus.APPLICATION_TAKEN], 
        colorClass: 'bg-indigo-50 border-indigo-200 text-indigo-700',
        description: 'Application taken or underwritting'
    },
    { 
        id: 'funded', 
        label: 'Funded', 
        statuses: [LeadStatus.FUNDED], 
        colorClass: 'bg-green-50 border-green-200 text-green-700',
        description: 'Closed loans'
    },
    { 
        id: 'archived', 
        label: 'Archived', 
        statuses: [LeadStatus.ARCHIVED, LeadStatus.LOST], 
        colorClass: 'bg-slate-100 border-slate-200 text-slate-500',
        description: 'Dead or lost opportunities'
    }
];

export const Dashboard: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const { searchTerm } = useSearch();
  const { currentUser } = useAuth();
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [duplicateLead, setDuplicateLead] = useState<Lead | null>(null);
  const [quickTouchLead, setQuickTouchLead] = useState<Lead | null>(null);
  
  // New Lead Form State
  const [borrowers, setBorrowers] = useState<Omit<Borrower, 'id'>[]>([{ firstName: '', lastName: '', phone: '', email: '', isPrimary: true }]);
  const [purpose, setPurpose] = useState('PURCHASE');

  // Quick Touch State
  const [touchType, setTouchType] = useState<TouchType>(TouchType.CALL);
  const [touchOutcome, setTouchOutcome] = useState<TouchOutcome>(TouchOutcome.SPOKE);
  const [touchContent, setTouchContent] = useState('');
  
  // Default to active pipeline stages
  const [activeFilters, setActiveFilters] = useState<string[]>(['new', 'attempted', 'talking', 'processing']);
  
  const navigate = useNavigate();

  // Load leads on mount AND when user changes
  useEffect(() => {
    setLeads(getLeads());
  }, [currentUser]); // Refresh when user switches

  const resetForm = () => {
      setBorrowers([{ firstName: '', lastName: '', phone: '', email: '', isPrimary: true }]);
      setPurpose('PURCHASE');
      setDuplicateLead(null);
      setIsModalOpen(false);
  };

  const handleAddBorrower = () => {
      if (borrowers.length < 4) {
          setBorrowers([...borrowers, { firstName: '', lastName: '', phone: '', email: '', isPrimary: false }]);
      }
  };

  const handleRemoveBorrower = (index: number) => {
      const newBorrowers = [...borrowers];
      newBorrowers.splice(index, 1);
      setBorrowers(newBorrowers);
  };

  const handleBorrowerChange = (index: number, field: keyof Omit<Borrower, 'id' | 'isPrimary'>, value: string) => {
      const newBorrowers = [...borrowers];
      (newBorrowers[index] as any)[field] = value;
      setBorrowers(newBorrowers);
  };

  const executeCreate = () => {
    createLead(borrowers, purpose as any);
    setLeads(getLeads());
    resetForm();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check duplication against ALL provided phones/emails
    let duplicate: Lead | undefined;
    for (const b of borrowers) {
        duplicate = findDuplicateLead(b.email, b.phone);
        if (duplicate) break;
    }

    if (duplicate) {
        setDuplicateLead(duplicate);
        return; 
    }
    executeCreate();
  };

  const handleArchiveAndReplace = () => {
      if (duplicateLead) {
          saveLead({ ...duplicateLead, status: LeadStatus.ARCHIVED });
          executeCreate();
      }
  };

  const handleUseExisting = () => {
      if (duplicateLead) {
          navigate(`/lead/${duplicateLead.id}`);
      }
  };

  const toggleFilter = (id: string) => {
      setActiveFilters(prev => 
          prev.includes(id) 
              ? prev.filter(f => f !== id) 
              : [...prev, id]
      );
  };

  const handleQuickTouchOpen = (e: React.MouseEvent, lead: Lead) => {
      e.preventDefault();
      e.stopPropagation();
      setQuickTouchLead(lead);
      setTouchType(TouchType.CALL);
      setTouchOutcome(TouchOutcome.SPOKE);
      setTouchContent('');
  };

  const handleQuickTouchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickTouchLead || !touchContent) return;
      
      addTouch({
          leadId: quickTouchLead.id,
          type: touchType,
          outcome: touchOutcome,
          content: touchContent,
          createdBy: currentUser.name
      });
      
      setLeads(getLeads()); // Refresh leads to update "Last Touch"
      setQuickTouchLead(null);
  };

  // --- Filtering Logic ---
  const filteredLeads = leads.filter(l => {
    // 1. Status Filter (Must match one of the active groups)
    const isInActiveGroup = STAGE_GROUPS.some(group => 
        activeFilters.includes(group.id) && group.statuses.includes(l.status)
    );
    if (!isInActiveGroup) return false;

    // 2. Search Filter (If text exists)
    if (!searchTerm) return true;
    
    const q = searchTerm.toLowerCase();
    
    // Check Basic Info (Iterate through ALL borrowers)
    const borrowerMatch = l.borrowers.some(b => 
        b.firstName.toLowerCase().includes(q) ||
        b.lastName.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        b.phone.includes(q)
    );

    // Check Property Info (State/Zip)
    const propertyMatch = (
        (l.loanParams.state && l.loanParams.state.toLowerCase().includes(q)) ||
        (l.loanParams.zip && l.loanParams.zip.includes(q))
    );

    return borrowerMatch || propertyMatch;
  });

  const getLeadsForGroup = (group: StageGroup) => filteredLeads.filter(l => group.statuses.includes(l.status));

  // --- Stagnation Logic ---
  const isStale = (lead: Lead) => {
    if (lead.status === LeadStatus.ARCHIVED || lead.status === LeadStatus.LOST || lead.status === LeadStatus.FUNDED) return false;
    const lastActivity = lead.lastTouchTimestamp || lead.createdAt;
    const daysSince = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
    return daysSince > 3;
  };

  const StatusColumn: React.FC<{ group: StageGroup; leads: Lead[] }> = ({ group, leads }) => {
    return (
      <div className="min-w-[300px] w-[300px] flex flex-col h-full animate-in fade-in zoom-in duration-300">
        <div className={`p-3 border-b-2 font-semibold text-sm uppercase tracking-wide flex justify-between items-center rounded-t-lg ${group.colorClass}`}>
          {group.label}
          <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold">{leads.length}</span>
        </div>
        <div className="flex-1 bg-slate-100/50 p-2 space-y-3 overflow-y-auto">
          {leads.map(lead => {
            const stale = isStale(lead);
            const primary = lead.borrowers.find(b => b.isPrimary) || lead.borrowers[0];
            const coBorrowerCount = lead.borrowers.length - 1;

            return (
              <Link key={lead.id} to={`/lead/${lead.id}`} className="block">
                <div className={`bg-white p-4 rounded-lg shadow-sm border transition-all cursor-pointer group relative ${stale ? 'border-red-200 shadow-red-100' : 'border-slate-200 hover:shadow-md hover:border-brand-300'}`}>
                  
                  {stale && (
                    <div className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 border border-red-200 shadow-sm z-10" title="Stale: No activity > 3 days">
                        <AlertCircle size={14} fill="white" />
                    </div>
                  )}

                  {/* Quick Touch Button (Appears on Hover) */}
                  <button 
                    onClick={(e) => handleQuickTouchOpen(e, lead)}
                    className="absolute top-2 right-2 bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                    title="Log Quick Touch"
                  >
                      <MessageSquare size={16} />
                  </button>

                  <div className="flex justify-between items-start mb-2 pr-6">
                    <div>
                        <h3 className="font-bold text-slate-800 group-hover:text-brand-600 truncate flex items-center gap-1">
                        {primary.lastName}, {primary.firstName}
                        {coBorrowerCount > 0 && <span className="text-xs text-slate-400 font-normal ml-1 flex items-center gap-0.5"><Users size={10} /> +{coBorrowerCount}</span>}
                        </h3>
                    </div>
                    {lead.loanParams.purpose === 'REFINANCE' && (
                       <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase shrink-0">Refi</span>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone size={12} />
                          {primary.phone}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                           <DollarSign size={12} />
                           {lead.loanParams.loanAmount > 0 ? `$${lead.loanParams.loanAmount.toLocaleString()}` : '-'}
                      </div>
                      {(lead.loanParams.state || lead.loanParams.zip) && (
                          <div className="text-xs text-slate-400 pl-5">
                             {lead.loanParams.state} {lead.loanParams.zip}
                          </div>
                      )}
                       <div className={`flex items-center gap-2 text-xs mt-2 pt-2 border-t border-slate-100 ${stale ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                          <Clock size={12} />
                          {lead.lastTouchTimestamp ? new Date(lead.lastTouchTimestamp).toLocaleDateString() : 'No activity'}
                      </div>
                  </div>
                </div>
              </Link>
            );
          })}
          {leads.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm italic">
                {searchTerm ? 'No matching leads' : 'Empty Stage'}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-2 shrink-0 space-y-4">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Pipeline</h2>
                <p className="text-slate-500 text-sm">
                    {currentUser.role === UserRole.ADMIN ? 'Admin View: All Leads' : 
                     currentUser.role === UserRole.PROCESSOR ? 'Processor View: All Leads' : 
                     'My Active Opportunities'}
                </p>
            </div>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
            >
            <Plus size={18} /> New Lead
            </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2 items-center pb-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
                <Filter size={14} /> Stage Filter:
            </div>
            {STAGE_GROUPS.map(group => {
                const isActive = activeFilters.includes(group.id);
                return (
                    <button
                        key={group.id}
                        onClick={() => toggleFilter(group.id)}
                        className={`
                            px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5
                            ${isActive 
                                ? `${group.colorClass.split(' ')[0]} ${group.colorClass.split(' ')[2]} border-transparent ring-1 ring-inset ring-black/5` 
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }
                        `}
                    >
                        {isActive && <Check size={12} />}
                        {group.label}
                    </button>
                )
            })}
             {activeFilters.length < STAGE_GROUPS.length && (
                <button 
                    onClick={() => setActiveFilters(STAGE_GROUPS.map(g => g.id))}
                    className="text-xs text-brand-600 hover:text-brand-800 ml-2 font-medium"
                >
                    Show All
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6 pt-2 flex gap-4">
        {STAGE_GROUPS.filter(g => activeFilters.includes(g.id)).map(group => (
            <StatusColumn 
                key={group.id} 
                group={group} 
                leads={getLeadsForGroup(group)} 
            />
        ))}
        {activeFilters.length === 0 && (
            <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Filter size={32} className="mb-2 opacity-20" />
                <p>No stages selected. Select a stage above to view leads.</p>
            </div>
        )}
      </div>

      {/* Lead Creation / Duplicate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-2xl w-[600px] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className={`p-4 border-b ${duplicateLead ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${duplicateLead ? 'text-amber-800' : 'text-slate-800'}`}>
                        {duplicateLead ? <AlertTriangle size={20} /> : <Plus size={20} />}
                        {duplicateLead ? 'Duplicate Lead Detected' : 'Add New Lead'}
                    </h3>
                </div>

                <div className="p-6 overflow-y-auto">
                    {duplicateLead ? (
                        <div className="space-y-6">
                            <p className="text-sm text-slate-600">
                                A lead with this phone/email already exists. How would you like to proceed?
                            </p>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-slate-900">
                                        {duplicateLead.borrowers[0].firstName} {duplicateLead.borrowers[0].lastName}
                                        {duplicateLead.borrowers.length > 1 && <span className="text-xs text-slate-400 font-normal"> (+{duplicateLead.borrowers.length - 1})</span>}
                                    </span>
                                    <span className="text-xs bg-slate-200 px-2 py-1 rounded-full font-bold text-slate-600">{duplicateLead.status}</span>
                                </div>
                                <div className="text-xs text-slate-500 space-y-1">
                                    <p>Phone: {duplicateLead.borrowers[0].phone}</p>
                                    <p>Email: {duplicateLead.borrowers[0].email}</p>
                                    <p>Last Activity: {duplicateLead.lastTouchTimestamp ? new Date(duplicateLead.lastTouchTimestamp).toLocaleDateString() : 'Never'}</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={handleUseExisting} className="flex items-center justify-center gap-2 w-full p-3 bg-brand-50 text-brand-700 font-bold rounded-lg border border-brand-200 hover:bg-brand-100 transition-colors">
                                    <ArrowRight size={16} /> Use Existing Lead
                                </button>
                                <button onClick={executeCreate} className="flex items-center justify-center gap-2 w-full p-3 bg-white text-slate-700 font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                    <UserPlus size={16} /> Create New Lead Anyway
                                </button>
                                <button onClick={handleArchiveAndReplace} className="flex items-center justify-center gap-2 w-full p-3 bg-white text-red-600 font-bold rounded-lg border border-slate-200 hover:bg-red-50 transition-colors">
                                    <Archive size={16} /> Archive Old & Create New
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form id="create-lead-form" onSubmit={handleCreateSubmit} className="space-y-5">
                            {borrowers.map((borrower, idx) => (
                                <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-100 relative group">
                                    {idx > 0 && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveBorrower(idx)}
                                            className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
                                        {borrower.isPrimary ? 'Primary Borrower' : 'Co-Borrower'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 mb-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
                                            <input 
                                                required={idx === 0}
                                                type="text" 
                                                className="w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 text-sm"
                                                value={borrower.firstName}
                                                onChange={(e) => handleBorrowerChange(idx, 'firstName', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                                            <input 
                                                required={idx === 0}
                                                type="text" 
                                                className="w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 text-sm"
                                                value={borrower.lastName}
                                                onChange={(e) => handleBorrowerChange(idx, 'lastName', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                                            <input 
                                                required={idx === 0}
                                                type="tel" 
                                                className="w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 text-sm"
                                                value={borrower.phone}
                                                onChange={(e) => handleBorrowerChange(idx, 'phone', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                                            <input 
                                                type="email" 
                                                className="w-full border-slate-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 text-sm"
                                                value={borrower.email}
                                                onChange={(e) => handleBorrowerChange(idx, 'email', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {borrowers.length < 4 && (
                                <button type="button" onClick={handleAddBorrower} className="text-xs font-bold text-brand-600 flex items-center gap-1 hover:text-brand-800">
                                    <Plus size={14} /> Add Co-Borrower
                                </button>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Loan Purpose</label>
                                <div className="flex gap-4">
                                    {['PURCHASE', 'REFINANCE'].map(p => (
                                        <label key={p} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="purpose" 
                                                value={p} 
                                                checked={purpose === p}
                                                onChange={(e) => setPurpose(e.target.value)}
                                                className="text-brand-600 focus:ring-brand-500"
                                            />
                                            {p}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={resetForm} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-900 transition-colors">
                        Cancel
                    </button>
                    {!duplicateLead && (
                        <button 
                            type="submit" 
                            form="create-lead-form"
                            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all"
                        >
                            Create Lead
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Quick Touch Modal */}
      {quickTouchLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-[500px] animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <MessageSquare className="text-brand-500" size={18} />
                          Quick Touch
                      </h3>
                      <button onClick={() => setQuickTouchLead(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                      <div className="text-sm font-bold text-slate-900">
                          {quickTouchLead.borrowers[0].firstName} {quickTouchLead.borrowers[0].lastName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-3">
                          <span className="flex items-center gap-1"><Phone size={10} /> {quickTouchLead.borrowers[0].phone}</span>
                          <span className="flex items-center gap-1"><Mail size={10} /> {quickTouchLead.borrowers[0].email || 'No email'}</span>
                      </div>
                  </div>

                  <form onSubmit={handleQuickTouchSubmit} className="p-6 space-y-4">
                      <div className="flex gap-2 justify-center">
                         <button 
                            type="button" 
                            onClick={() => setTouchType(TouchType.CALL)}
                            className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all flex flex-col items-center gap-1 ${touchType === TouchType.CALL ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Phone size={16} /> Call
                        </button>
                         <button 
                            type="button" 
                            onClick={() => setTouchType(TouchType.TEXT)}
                            className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all flex flex-col items-center gap-1 ${touchType === TouchType.TEXT ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <MessageSquare size={16} /> Text
                        </button>
                         <button 
                            type="button" 
                            onClick={() => setTouchType(TouchType.EMAIL)}
                            className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all flex flex-col items-center gap-1 ${touchType === TouchType.EMAIL ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Mail size={16} /> Email
                        </button>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Outcome</label>
                          <select 
                            value={touchOutcome} 
                            onChange={(e) => setTouchOutcome(e.target.value as TouchOutcome)}
                            className="w-full bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500"
                        >
                            {Object.values(TouchOutcome).map(o => (
                                <option key={o} value={o}>{o.replace('_', ' ')}</option>
                            ))}
                        </select>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes</label>
                          <textarea
                            autoFocus
                            required
                            value={touchContent}
                            onChange={(e) => setTouchContent(e.target.value)}
                            placeholder="Details about the conversation..."
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 resize-none h-24"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={!touchContent.trim()}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                          <Save size={18} /> Log Interaction
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};