import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Phone, Mail, MessageSquare, Save, ArrowLeft, Calendar, 
    CheckCircle2, Clock, BrainCircuit, Sparkles, Send, ChevronRight, Calculator,
    History, AlertTriangle, X, Users, User, Plus, Trash2, Check, RotateCcw, ArrowRight, Briefcase, MessageCircle, TrendingUp
} from 'lucide-react';
import { getLead, saveLead, getTouches, addTouch, deleteTouch } from '../services/storage';
import { generateLeadSummary, suggestNextAction } from '../services/geminiService';
import { Lead, Touch, TouchType, TouchOutcome, LeadStatus, PropertyType, PropertyUse, ChangeReason, ChangeLogEntry, Borrower, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

// --- Types for Change Management ---
interface DetectedChange {
    id: string; // unique id for the change instance
    field: string;
    label: string;
    oldValue: any;
    newValue: any;
    reason: ChangeReason;
    comment: string;
    isApplied: boolean; // toggle to accept/deny
}

// --- Helper Components ---

const SmartInput = React.memo(({ 
    label, 
    value, 
    onChange,
    type = "text", 
    className = "",
    placeholder = ""
}: { 
    label?: string; 
    value: string | number; 
    onChange: (val: string) => void; 
    type?: string; 
    className?: string; 
    placeholder?: string;
}) => (
    <div className={className}>
        {label && <label className="text-xs text-slate-500 block mb-1">{label}</label>}
        <input
            type={type}
            step={type === 'number' ? "any" : undefined}
            className={`w-full border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:ring-0 bg-transparent px-0 py-1 font-medium text-slate-900 transition-colors ${!label ? 'text-lg font-bold' : 'text-sm'}`}
            value={value || ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
        />
    </div>
));

const SmartSelect = React.memo(({
    label,
    value,
    options,
    onChange
}: {
    label?: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (val: string) => void;
}) => (
    <div>
         {label && <label className="text-xs text-slate-500 block mb-1">{label}</label>}
         <select
            className="w-full border-slate-300 rounded text-sm p-1.5 bg-slate-50 focus:ring-2 focus:ring-brand-500"
            value={value}
            onChange={(e) => onChange(e.target.value)}
         >
             {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
         </select>
    </div>
));

export const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, availableUsers } = useAuth();
  
  // Data State
  const [lead, setLead] = useState<Lead | null>(null); 
  const [localLead, setLocalLead] = useState<Lead | null>(null); 
  const [touches, setTouches] = useState<Touch[]>([]);
  const [activeBorrowerIndex, setActiveBorrowerIndex] = useState(0);
  
  // AI State
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiSuggestion, setAiSuggestion] = useState<{action: string, rationale: string} | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Interaction State
  const [touchContent, setTouchContent] = useState('');
  const [touchType, setTouchType] = useState<TouchType>(TouchType.CALL);
  const [touchOutcome, setTouchOutcome] = useState<TouchOutcome>(TouchOutcome.SPOKE);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Change Management UI State
  const [detectedChanges, setDetectedChanges] = useState<DetectedChange[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!id) return;
    const l = getLead(id);
    if (!l) {
        navigate('/'); 
        return;
    }
    setLead(l);
    setLocalLead(JSON.parse(JSON.stringify(l))); 
    setTouches(getTouches(id));
  }, [id, navigate, currentUser]);

  useEffect(() => {
    if (lead && touches.length > 0) {
        setLoadingAi(true);
        Promise.all([
            generateLeadSummary(lead, touches),
            suggestNextAction(lead, touches)
        ]).then(([summary, suggestion]) => {
            setAiSummary(summary);
            setAiSuggestion(suggestion);
            setLoadingAi(false);
        }).catch(() => setLoadingAi(false));
    }
  }, [lead?.id, touches.length]);

  const isDirty = useMemo(() => {
      if (!lead || !localLead) return false;
      return JSON.stringify(lead) !== JSON.stringify(localLead);
  }, [lead, localLead]);

  const handleUpdateField = (field: string, value: any, section: 'root' | 'loanParams' | 'borrower', borrowerIndex: number = 0) => {
      if (!localLead) return;
      const updated = { ...localLead };
      if (section === 'loanParams') {
          updated.loanParams = { ...updated.loanParams, [field]: value };
      } else if (section === 'borrower') {
          const newBorrowers = [...updated.borrowers];
          newBorrowers[borrowerIndex] = { ...newBorrowers[borrowerIndex], [field]: value };
          updated.borrowers = newBorrowers;
      } else {
          (updated as any)[field] = value;
      }
      setLocalLead(updated);
  };

  const handleAddBorrower = () => {
    if (!localLead || localLead.borrowers.length >= 4) return;
    const newBorrower: Borrower = {
        id: Math.random().toString(36).substr(2, 9),
        firstName: 'New',
        lastName: 'Borrower',
        email: '',
        phone: '',
        isPrimary: false
    };
    const updated = { ...localLead, borrowers: [...localLead.borrowers, newBorrower] };
    const log: ChangeLogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          field: 'Borrowers',
          oldValue: localLead.borrowers.length,
          newValue: updated.borrowers.length,
          reason: 'BORROWER_REQUEST', 
          comment: 'Added new co-borrower',
          changedBy: currentUser.name
    };
    updated.changeLog = [log, ...(updated.changeLog || [])];
    saveLead(updated);
    setLead(updated);
    setLocalLead(updated);
    setActiveBorrowerIndex(updated.borrowers.length - 1);
  };

  const handleRemoveBorrower = (index: number) => {
     if (!localLead || index === 0) return;
     const updated = { ...localLead };
     const removed = updated.borrowers[index];
     updated.borrowers = updated.borrowers.filter((_, i) => i !== index);
     const log: ChangeLogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          field: 'Borrowers',
          oldValue: `Deleted ${removed.firstName}`,
          newValue: 'Removed',
          reason: 'OTHER', 
          comment: 'Removed co-borrower',
          changedBy: currentUser.name
    };
    updated.changeLog = [log, ...(updated.changeLog || [])];
    saveLead(updated);
    setLead(updated);
    setLocalLead(updated);
    setActiveBorrowerIndex(0);
  };

  const handleSaveTouch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !touchContent.trim()) return;
    const newTouch = addTouch({
        leadId: lead.id,
        type: touchType,
        outcome: touchOutcome,
        content: touchContent,
        createdBy: currentUser.name
    });
    setTouches([newTouch, ...touches]);
    setTouchContent('');
    const updatedLead = getLead(lead.id);
    if (updatedLead) {
        setLead(updatedLead);
        setLocalLead(updatedLead);
    }
  };

  const handleDeleteTouch = (touchId: string) => {
      if (!lead || !window.confirm('Are you sure you want to delete this touch? This action is logged.')) return;
      deleteTouch(touchId, lead.id);
      setTouches(touches.filter(t => t.id !== touchId));
      const updatedLead = getLead(lead.id);
      if (updatedLead) {
          setLead(updatedLead);
          setLocalLead(updatedLead);
      }
  };

  const prepareReview = () => {
      if (!lead || !localLead) return;
      const changes: DetectedChange[] = [];
      if (lead.status !== localLead.status) {
           changes.push({ id: 'status', field: 'status', label: 'Lead Status', oldValue: lead.status, newValue: localLead.status, reason: 'CORRECTION', comment: '', isApplied: true });
      }
      if (lead.assignedTo !== localLead.assignedTo) {
          changes.push({ id: 'assignedTo', field: 'assignedTo', label: 'LO Assignment', oldValue: availableUsers.find(u => u.id === lead.assignedTo)?.name || 'Unknown', newValue: availableUsers.find(u => u.id === localLead.assignedTo)?.name || 'Unknown', reason: 'OTHER', comment: 'Reassigned LO', isApplied: true });
      }
      if (lead.processorId !== localLead.processorId) {
          changes.push({ id: 'processorId', field: 'processorId', label: 'Processor Assignment', oldValue: availableUsers.find(u => u.id === lead.processorId)?.name || 'Unassigned', newValue: availableUsers.find(u => u.id === localLead.processorId)?.name || 'Unassigned', reason: 'OTHER', comment: 'Updated Processor', isApplied: true });
      }
      Object.keys(lead.loanParams).forEach((key) => {
          const k = key as keyof typeof lead.loanParams;
          if (lead.loanParams[k] != localLead.loanParams[k]) {
              changes.push({ id: `lp-${key}`, field: key, label: `Loan ${key.replace(/([A-Z])/g, ' $1').trim()}`, oldValue: lead.loanParams[k], newValue: localLead.loanParams[k], reason: 'CORRECTION', comment: '', isApplied: true });
          }
      });
      localLead.borrowers.forEach((b, idx) => {
          const original = lead.borrowers.find(ob => ob.id === b.id);
          if (!original) return;
          const prefix = b.isPrimary ? 'Primary' : `Co-Borrower ${idx}`;
          Object.keys(b).forEach((key) => {
              const k = key as keyof typeof b;
              if (k === 'id' || k === 'isPrimary') return;
              if (original[k] != b[k]) {
                  changes.push({ id: `b-${b.id}-${key}`, field: `${prefix} ${key}`, label: `${prefix} ${key.charAt(0).toUpperCase() + key.slice(1)}`, oldValue: original[k], newValue: b[k], reason: 'CORRECTION', comment: '', isApplied: true });
              }
          });
      });
      setDetectedChanges(changes);
      setIsReviewModalOpen(true);
  };

  const handleRevert = () => {
      if (!lead) return;
      setLocalLead(JSON.parse(JSON.stringify(lead)));
  };

  const executeBatchSave = () => {
      if (!localLead || !lead) return;
      const finalLead = JSON.parse(JSON.stringify(localLead));
      const newLogs: ChangeLogEntry[] = [];
      const appliedChanges = detectedChanges.filter(c => c.isApplied);
      const unappliedChanges = detectedChanges.filter(c => !c.isApplied);
      unappliedChanges.forEach(c => {
          if (c.id === 'status') finalLead.status = c.oldValue;
          else if (c.id === 'assignedTo') finalLead.assignedTo = lead.assignedTo;
          else if (c.id === 'processorId') finalLead.processorId = lead.processorId;
          else if (c.id.startsWith('lp-')) {
              const key = c.field as keyof typeof finalLead.loanParams;
              finalLead.loanParams[key] = c.oldValue;
          } else if (c.id.startsWith('b-')) {
               const parts = c.id.split('-');
               const bId = parts[1];
               const field = parts.slice(2).join('-');
               const bIndex = finalLead.borrowers.findIndex((b: any) => b.id === bId);
               if (bIndex >= 0) finalLead.borrowers[bIndex][field] = c.oldValue;
          }
      });
      appliedChanges.forEach(c => {
          newLogs.push({ id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), field: c.label, oldValue: c.oldValue, newValue: c.newValue, reason: c.reason, comment: c.comment, changedBy: currentUser.name });
      });
      finalLead.changeLog = [...newLogs, ...(finalLead.changeLog || [])];
      saveLead(finalLead);
      setLead(finalLead);
      setLocalLead(finalLead);
      setIsReviewModalOpen(false);
      setDetectedChanges([]);
  };

  const ltv = localLead && localLead.loanParams.purchasePrice > 0 
    ? Math.round((localLead.loanParams.loanAmount / localLead.loanParams.purchasePrice) * 100) 
    : 0;
  const primaryBorrower = localLead?.borrowers.find(b => b.isPrimary) || localLead?.borrowers[0];
  const activeBorrower = localLead?.borrowers[activeBorrowerIndex];
  const loOptions = availableUsers.filter(u => u.role === UserRole.LO || u.role === UserRole.ADMIN);
  const processorOptions = availableUsers.filter(u => u.role === UserRole.PROCESSOR || u.role === UserRole.ADMIN);

  if (!lead || !localLead || !primaryBorrower || !activeBorrower) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-700">
                <ArrowLeft size={20} />
            </button>
            <div>
                <div className="flex gap-2 items-center mb-1">
                    <h1 className="text-xl font-bold text-slate-900 leading-none">
                        {primaryBorrower.firstName} {primaryBorrower.lastName}
                    </h1>
                    {localLead.borrowers.length > 1 && (
                         <span className="text-sm bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                             <Users size={12} /> +{localLead.borrowers.length - 1}
                         </span>
                    )}
                </div>
                <div className="flex gap-2 text-xs text-slate-500 items-center">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${lead.status === LeadStatus.NEW ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {lead.status}
                    </span>
                    <span>•</span>
                    <span>Created {new Date(lead.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="font-bold text-slate-800">{lead.totalTouches} touches</span>
                </div>
            </div>
        </div>
        <div className="flex gap-3 items-center">
             <div className="flex gap-2 mr-4 border-r border-slate-200 pr-4">
                 {currentUser.role === UserRole.ADMIN ? (
                     <div className="flex flex-col">
                         <label className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Loan Officer</label>
                         <select 
                            className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-brand-500 w-32"
                            value={localLead.assignedTo}
                            onChange={(e) => handleUpdateField('assignedTo', e.target.value, 'root')}
                         >
                             {loOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                         </select>
                     </div>
                 ) : (
                    <div className="flex flex-col">
                         <label className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Loan Officer</label>
                         <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-200 w-32 truncate">
                             <User size={12} className="text-slate-400" />
                             {availableUsers.find(u => u.id === localLead.assignedTo)?.name || 'Unknown'}
                         </div>
                    </div>
                 )}
                 {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.LO) ? (
                     <div className="flex flex-col">
                         <label className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Processor</label>
                         <select 
                            className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-brand-500 w-32"
                            value={localLead.processorId || ''}
                            onChange={(e) => handleUpdateField('processorId', e.target.value || undefined, 'root')}
                         >
                             <option value="">Unassigned</option>
                             {processorOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                         </select>
                     </div>
                 ) : (
                    <div className="flex flex-col">
                         <label className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Processor</label>
                         <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-200 w-32 truncate">
                             <Briefcase size={12} className="text-slate-400" />
                             {availableUsers.find(u => u.id === localLead.processorId)?.name || 'Unassigned'}
                         </div>
                    </div>
                 )}
             </div>
             <div className="flex flex-col">
                <label className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Stage</label>
                <select 
                    className="bg-slate-50 border border-slate-300 rounded px-3 py-1 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand-500"
                    value={localLead.status}
                    onChange={(e) => handleUpdateField('status', e.target.value, 'root')}
                >
                    {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
            </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden pb-16"> 
        <div className="w-80 border-r border-slate-200 bg-white overflow-y-auto p-6 space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Borrower Info</h3>
                    <div className="flex gap-1 items-center">
                        {localLead.borrowers.map((b, idx) => (
                            <button key={b.id} onClick={() => setActiveBorrowerIndex(idx)} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${activeBorrowerIndex === idx ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title={`${b.firstName} ${b.lastName}`}>
                                {idx === 0 ? 'P' : `C${idx}`}
                            </button>
                        ))}
                        {localLead.borrowers.length < 4 && (
                            <button onClick={handleAddBorrower} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Add Co-Borrower">
                                <Plus size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 transition-all relative">
                    {!activeBorrower.isPrimary && (
                        <button onClick={() => handleRemoveBorrower(activeBorrowerIndex)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors" title="Remove this co-borrower">
                            <Trash2 size={14} />
                        </button>
                    )}
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            {activeBorrower.isPrimary ? 'Primary Borrower' : `Co-Borrower ${activeBorrowerIndex}`}
                            {activeBorrower.isPrimary && <span className="bg-brand-100 text-brand-700 text-[10px] px-1.5 py-0.5 rounded-full">Owner</span>}
                        </span>
                    </div>
                    <div className="flex gap-2 mb-3">
                        <SmartInput value={activeBorrower.firstName} onChange={(v) => handleUpdateField('firstName', v, 'borrower', activeBorrowerIndex)} className="w-full" placeholder="First" />
                        <SmartInput value={activeBorrower.lastName} onChange={(v) => handleUpdateField('lastName', v, 'borrower', activeBorrowerIndex)} className="w-full" placeholder="Last" />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-slate-700">
                            <Phone size={16} className="text-slate-400 shrink-0" />
                            <SmartInput value={activeBorrower.phone} onChange={(v) => handleUpdateField('phone', v, 'borrower', activeBorrowerIndex)} placeholder="Phone" />
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <Mail size={16} className="text-slate-400 shrink-0" />
                            <SmartInput value={activeBorrower.email} onChange={(v) => handleUpdateField('email', v, 'borrower', activeBorrowerIndex)} placeholder="Email" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="border-t border-slate-100 pt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
                    Loan Details
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ltv > 80 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {ltv}% LTV
                    </span>
                </h3>
                <div className="space-y-4">
                    <SmartSelect label="Purpose" value={localLead.loanParams.purpose} onChange={(v) => handleUpdateField('purpose', v, 'loanParams')} options={[{value: 'PURCHASE', label: 'Purchase'}, {value: 'REFINANCE', label: 'Refinance'}, {value: 'HELOC', label: 'HELOC'}]} />
                    <div className="grid grid-cols-2 gap-3">
                        <SmartInput label="Amount ($)" type="number" value={localLead.loanParams.loanAmount} onChange={(v) => handleUpdateField('loanAmount', parseFloat(v), 'loanParams')} />
                        <SmartInput label="Value/Price ($)" type="number" value={localLead.loanParams.purchasePrice} onChange={(v) => handleUpdateField('purchasePrice', parseFloat(v), 'loanParams')} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <SmartInput label="Rate (%)" type="number" value={localLead.loanParams.interestRate} onChange={(v) => handleUpdateField('interestRate', parseFloat(v), 'loanParams')} />
                        <SmartInput label="FICO" type="number" value={localLead.loanParams.creditScore || ''} onChange={(v) => handleUpdateField('creditScore', parseFloat(v), 'loanParams')} placeholder="740" />
                    </div>
                </div>
            </div>
            <div className="border-t border-slate-100 pt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Property</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                         <SmartSelect label="Type" value={localLead.loanParams.propertyType || PropertyType.SFH} onChange={(v) => handleUpdateField('propertyType', v, 'loanParams')} options={Object.values(PropertyType).map(v => ({value: v, label: v}))} />
                         <SmartSelect label="Use" value={localLead.loanParams.propertyUse || PropertyUse.PRIMARY} onChange={(v) => handleUpdateField('propertyUse', v, 'loanParams')} options={Object.values(PropertyUse).map(v => ({value: v, label: v}))} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                         <div className="col-span-2">
                             <SmartInput label="State" value={localLead.loanParams.state || ''} onChange={(v) => handleUpdateField('state', v, 'loanParams')} placeholder="TX" />
                         </div>
                         <div>
                             <SmartInput label="Zip" value={localLead.loanParams.zip || ''} onChange={(v) => handleUpdateField('zip', v, 'loanParams')} placeholder="75001" />
                         </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col bg-slate-50 min-w-[400px]">
            <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
                {touches.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                        <MessageSquare size={48} className="mb-2" />
                        <p>No history yet. Log your first touch below.</p>
                    </div>
                ) : (
                    touches.map((touch) => (
                        <div key={touch.id} className="flex gap-4 group relative pr-8">
                            {currentUser.role === UserRole.ADMIN && (
                                <button onClick={() => handleDeleteTouch(touch.id)} className="absolute right-0 top-0 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1" title="Delete touch (Admin only)">
                                    <Trash2 size={14} />
                                </button>
                            )}
                            <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${
                                    touch.type === TouchType.CALL ? 'bg-blue-100 border-blue-200 text-blue-600' :
                                    touch.type === TouchType.EMAIL ? 'bg-purple-100 border-purple-200 text-purple-600' :
                                    touch.type === TouchType.TEXT ? 'bg-indigo-100 border-indigo-200 text-indigo-600' :
                                    touch.type === TouchType.WHATSAPP ? 'bg-green-100 border-green-200 text-green-600' :
                                    'bg-slate-100 border-slate-200 text-slate-600'
                                }`}>
                                    {touch.type === TouchType.CALL && <Phone size={14} />}
                                    {touch.type === TouchType.EMAIL && <Mail size={14} />}
                                    {touch.type === TouchType.TEXT && <MessageSquare size={14} />}
                                    {touch.type === TouchType.WHATSAPP && <MessageCircle size={14} />}
                                    {touch.type === TouchType.NOTE && <Briefcase size={14} />}
                                </div>
                                <div className="w-px h-full bg-slate-200 my-2 group-last:hidden"></div>
                            </div>
                            <div className="flex-1 pb-4">
                                <div className="flex justify-between items-start mb-1">
                                    <div>
                                        <span className="font-bold text-sm text-slate-900">{touch.type}</span>
                                        <span className="mx-2 text-slate-300">•</span>
                                        <span className="text-sm text-slate-600 font-medium capitalize">{touch.outcome.toLowerCase().replace('_', ' ')}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{new Date(touch.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                                    {touch.content}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 pl-1">Logged by {touch.createdBy}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="p-4 bg-white border-t border-slate-200">
                <form onSubmit={handleSaveTouch} className="max-w-4xl mx-auto">
                    <div className="flex gap-4 mb-3">
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                            <button type="button" onClick={() => setTouchType(TouchType.CALL)} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${touchType === TouchType.CALL ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Call</button>
                            <button type="button" onClick={() => setTouchType(TouchType.EMAIL)} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${touchType === TouchType.EMAIL ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}>Email</button>
                            <button type="button" onClick={() => setTouchType(TouchType.TEXT)} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${touchType === TouchType.TEXT ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Text</button>
                            <button type="button" onClick={() => setTouchType(TouchType.WHATSAPP)} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${touchType === TouchType.WHATSAPP ? 'bg-white shadow text-green-600' : 'text-slate-500 hover:text-slate-700'}`}>WhatsApp</button>
                            <button type="button" onClick={() => setTouchType(TouchType.NOTE)} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${touchType === TouchType.NOTE ? 'bg-white shadow text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>Note</button>
                        </div>
                        <select value={touchOutcome} onChange={(e) => setTouchOutcome(e.target.value as TouchOutcome)} className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-1 focus:ring-2 focus:ring-brand-500">
                            {Object.values(TouchOutcome).map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <textarea required value={touchContent} onChange={(e) => setTouchContent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveTouch(e); } }} placeholder="Log your conversation, notes, or next steps..." className="w-full border border-slate-300 rounded-lg p-3 pr-12 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none h-24 shadow-inner" />
                        <button type="submit" disabled={!touchContent.trim()} className="absolute bottom-3 right-3 p-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <Send size={16} />
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 shadow-sm">
                     <div className="flex items-center gap-2 mb-3">
                        <BrainCircuit className="text-indigo-600" size={18} />
                        <h3 className="font-bold text-indigo-900 text-sm">Interaction Summary</h3>
                    </div>
                    {loadingAi ? (
                        <div className="animate-pulse space-y-2">
                            <div className="h-2 bg-indigo-200 rounded w-3/4"></div>
                            <div className="h-2 bg-indigo-200 rounded w-full"></div>
                        </div>
                    ) : (
                        <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                            {aiSummary || "Log activity to generate summary."}
                        </p>
                    )}
                </div>

                {aiSuggestion && !loadingAi && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 shadow-sm animate-in fade-in slide-in-from-right duration-500">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="text-emerald-600" size={18} />
                            <h3 className="font-bold text-emerald-900 text-sm">Recommended Action</h3>
                        </div>
                        <div className="mb-2">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Target Task</span>
                            <p className="text-sm font-bold text-emerald-950">{aiSuggestion.action}</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Strategic Rationale</span>
                            <p className="text-xs text-emerald-800 leading-relaxed mt-1">{aiSuggestion.rationale}</p>
                        </div>
                    </div>
                )}

                <div>
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
                         Audit Log
                         <button onClick={() => setShowHistory(!showHistory)} className="text-brand-600 hover:text-brand-800 text-[10px] bg-brand-50 px-2 py-0.5 rounded">
                             {showHistory ? 'Hide' : 'Show'}
                         </button>
                     </h3>
                     {showHistory && (
                         <div className="space-y-3 relative">
                             <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-200"></div>
                             {lead.changeLog && lead.changeLog.length > 0 ? lead.changeLog.map(log => (
                                 <div key={log.id} className="relative pl-6">
                                     <div className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-slate-300 border border-white"></div>
                                     <div className="text-xs text-slate-500 mb-0.5">{new Date(log.timestamp).toLocaleDateString()} <span className="text-slate-300">•</span> {log.reason.replace('_', ' ')}</div>
                                     {log.comment && <div className="text-xs text-slate-500 italic mb-1 bg-slate-50 p-1 rounded border border-slate-100">"{log.comment}"</div>}
                                     <div className="text-xs text-slate-800"><span className="font-bold">{log.field}:</span> {log.oldValue} <span className="text-slate-400">→</span> <span className="font-bold text-slate-900">{log.newValue}</span></div>
                                     <div className="text-[10px] text-slate-400 mt-0.5 flex justify-end">By: {log.changedBy}</div>
                                 </div>
                             )) : <div className="text-xs text-slate-400 italic pl-6">No changes recorded</div>}
                         </div>
                     )}
                </div>
            </div>
        </div>
      </div>

      {isDirty && (
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900 text-white p-4 shadow-2xl flex items-center justify-between z-30 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center gap-3">
                  <AlertTriangle className="text-amber-400" />
                  <div>
                      <p className="font-bold text-sm">Unsaved Changes</p>
                      <p className="text-xs text-slate-400">Review modifications before committing to history.</p>
                  </div>
              </div>
              <div className="flex gap-3">
                  <button onClick={handleRevert} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">Discard</button>
                  <button onClick={prepareReview} className="px-6 py-2 rounded-lg text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg transition-all flex items-center gap-2">Review & Save <ArrowRight size={16} /></button>
              </div>
          </div>
      )}

      {isReviewModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><CheckCircle2 className="text-brand-600" /> Review Changes</h2>
                      <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                      {detectedChanges.length === 0 ? <div className="text-center py-10 text-slate-500">No changes detected.</div> : (
                          <div className="space-y-4">
                              {detectedChanges.map((change, idx) => (
                                  <div key={change.id} className={`bg-white border rounded-lg p-4 transition-all ${change.isApplied ? 'border-brand-200 shadow-sm' : 'border-slate-200 opacity-60 grayscale'}`}>
                                      <div className="flex items-start gap-4">
                                          <div className="pt-1"><input type="checkbox" checked={change.isApplied} onChange={() => { const updated = [...detectedChanges]; updated[idx].isApplied = !updated[idx].isApplied; setDetectedChanges(updated); }} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></div>
                                          <div className="flex-1">
                                              <div className="flex justify-between items-start mb-2">
                                                  <div>
                                                      <h4 className="font-bold text-slate-800 text-sm">{change.label}</h4>
                                                      <div className="text-xs flex items-center gap-2 mt-1"><span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded line-through">{String(change.oldValue)}</span><ArrowRight size={12} className="text-slate-400" /><span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold">{String(change.newValue)}</span></div>
                                                  </div>
                                                  <select value={change.reason} onChange={(e) => { const updated = [...detectedChanges]; updated[idx].reason = e.target.value as ChangeReason; setDetectedChanges(updated); }} className="text-xs border border-slate-200 rounded p-1 bg-slate-50 text-slate-600 focus:ring-1 focus:ring-brand-500" disabled={!change.isApplied}>{(['CORRECTION', 'BORROWER_REQUEST', 'SCENARIO_TEST', 'OTHER'] as ChangeReason[]).map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select>
                                              </div>
                                              <input type="text" placeholder="Add a note (optional)..." value={change.comment} onChange={(e) => { const updated = [...detectedChanges]; updated[idx].comment = e.target.value; setDetectedChanges(updated); }} className="w-full text-xs border-b border-slate-200 focus:border-brand-500 focus:ring-0 px-0 py-1 bg-transparent" disabled={!change.isApplied} />
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <div className="p-6 border-t border-slate-100 bg-white rounded-b-xl flex justify-between items-center">
                      <div className="text-sm text-slate-500"><strong>{detectedChanges.filter(c => c.isApplied).length}</strong> changes will be saved.</div>
                      <div className="flex gap-3">
                          <button onClick={() => setIsReviewModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                          <button onClick={executeBatchSave} className="px-8 py-2.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg transition-colors flex items-center gap-2"><Save size={18} /> Confirm Updates</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};