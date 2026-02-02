import { Lead, Touch, LeadStatus, TouchType, TouchOutcome, LoanParams, PropertyType, PropertyUse, Borrower, User, UserRole } from '../types';

const LEADS_KEY = 'brokeros_leads_v1';
const TOUCHES_KEY = 'brokeros_touches_v1';
const USERS_KEY = 'brokeros_users_v1';
const CURRENT_USER_ID_KEY = 'brokeros_current_user_id';

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- SEED DATA ---

const SEED_USERS: User[] = [
    { id: 'admin1', name: 'Alice Admin', email: 'admin@brokeros.dev', role: UserRole.ADMIN, createdAt: Date.now() },
    { id: 'lo1', name: 'Lenny Loan Officer', email: 'lenny@brokeros.dev', role: UserRole.LO, createdAt: Date.now() },
    { id: 'lo2', name: 'Larry Late', email: 'larry@brokeros.dev', role: UserRole.LO, createdAt: Date.now() },
    { id: 'proc1', name: 'Patty Processor', email: 'patty@brokeros.dev', role: UserRole.PROCESSOR, createdAt: Date.now() }
];

export const getUsers = (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) {
        localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
        return SEED_USERS;
    }
    return JSON.parse(data);
};

export const getCurrentUser = (): User => {
    const users = getUsers();
    const storedId = localStorage.getItem(CURRENT_USER_ID_KEY);
    // Default to LO1 if no session
    return users.find(u => u.id === storedId) || users.find(u => u.id === 'lo1') || users[0];
};

export const switchUser = (userId: string): User => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
        localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
        return user;
    }
    return getCurrentUser();
};

const seedLeads = (): Lead[] => [
  {
    id: 'l1',
    assignedTo: 'lo1', // Assigned to Lenny
    processorId: undefined,
    borrowers: [{
        id: 'b1',
        firstName: 'James',
        lastName: 'Richardson',
        email: 'james.r@example.com',
        phone: '555-0123',
        isPrimary: true
    }],
    status: LeadStatus.NEW,
    createdAt: Date.now() - 10000000,
    updatedAt: Date.now(),
    lastTouchTimestamp: null,
    totalTouches: 0,
    nextFollowUp: null,
    loanParams: {
      loanAmount: 450000,
      purchasePrice: 500000,
      interestRate: 7.125,
      loanType: 'CONV',
      purpose: 'PURCHASE',
      propertyType: PropertyType.SFH,
      propertyUse: PropertyUse.PRIMARY,
      state: 'TX',
      zip: '75001',
      creditScore: 740
    },
    changeLog: []
  },
  {
    id: 'l2',
    assignedTo: 'lo1', // Assigned to Lenny
    processorId: undefined,
    borrowers: [{
        id: 'b2',
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah.c@skynet.com',
        phone: '555-0999',
        isPrimary: true
    }],
    status: LeadStatus.IN_COMMUNICATION,
    createdAt: Date.now() - 5000000,
    updatedAt: Date.now(),
    lastTouchTimestamp: Date.now() - (5 * 24 * 60 * 60 * 1000), 
    lastTouchType: TouchType.CALL,
    totalTouches: 1,
    nextFollowUp: Date.now() + 86400000,
    loanParams: {
      loanAmount: 320000,
      purchasePrice: 400000,
      interestRate: 3.25,
      loanType: 'VA',
      purpose: 'REFINANCE',
      propertyType: PropertyType.SFH,
      propertyUse: PropertyUse.PRIMARY,
      state: 'CA',
      zip: '90210',
      creditScore: 680
    },
    changeLog: []
  },
  {
    id: 'l3',
    assignedTo: 'lo2', // Assigned to Larry (LO1 should NOT see this)
    processorId: 'proc1', // Assigned to Patty Processor
    borrowers: [
        {
            id: 'b3',
            firstName: 'Robert',
            lastName: 'Vance',
            email: 'bob.vance@refrigeration.com',
            phone: '555-2323',
            isPrimary: true
        }
    ],
    status: LeadStatus.PROCESSING,
    createdAt: Date.now() - 100000000,
    updatedAt: Date.now(),
    lastTouchTimestamp: Date.now() - 3600000, 
    lastTouchType: TouchType.EMAIL,
    totalTouches: 5,
    nextFollowUp: null,
    loanParams: {
      loanAmount: 600000,
      purchasePrice: 850000,
      interestRate: 6.5,
      loanType: 'CONV',
      purpose: 'PURCHASE',
      propertyType: PropertyType.MULTI,
      propertyUse: PropertyUse.INVESTMENT,
      state: 'PA',
      zip: '18503',
      creditScore: 780
    },
    changeLog: []
  }
];

// --- CORE FUNCTIONS ---

/**
 * Returns leads visible to the current user based on RBAC.
 */
export const getLeads = (): Lead[] => {
  const user = getCurrentUser();
  const data = localStorage.getItem(LEADS_KEY);
  
  let allLeads: Lead[] = [];

  if (!data) {
    const seed = seedLeads();
    console.log('BrokerOS: Seeding Initial Data');
    localStorage.setItem(LEADS_KEY, JSON.stringify(seed));
    allLeads = seed;
  } else {
    try {
        allLeads = JSON.parse(data);
    } catch (e) {
        console.error('BrokerOS: JSON Parse Error, resetting to seed to prevent crash', e);
        const seed = seedLeads();
        allLeads = seed;
    }
  }
  
  // MIGRATION: Ensure basic structure matches Schema
  allLeads = allLeads.map((l: any) => {
      // Fix missing assignments from old data
      if (!l.assignedTo) l.assignedTo = 'lo1'; 
      if (l.totalTouches === undefined) l.totalTouches = 0;
      return l;
  });

  // RBAC LOGIC
  if (user.role === UserRole.ADMIN || user.role === UserRole.PROCESSOR) {
      return allLeads;
  }
  
  // LOs only see their own leads
  return allLeads.filter(l => l.assignedTo === user.id);
};

export const getLead = (id: string): Lead | undefined => {
  // getLeads() already applies RBAC, so this is safe
  const leads = getLeads();
  return leads.find(l => l.id === id);
};

export const findDuplicateLead = (email: string, phone: string): Lead | undefined => {
  const leads = getLeads();
  return leads.find(l => 
    l.borrowers.some(b => 
        (email && b.email.toLowerCase() === email.toLowerCase()) || 
        (phone && b.phone === phone)
    )
  );
};

export const saveLead = (lead: Lead): void => {
  // We need to read ALL leads to write back, not just visible ones
  const data = localStorage.getItem(LEADS_KEY);
  let allLeads: Lead[] = data ? JSON.parse(data) : [];
  
  const index = allLeads.findIndex(l => l.id === lead.id);
  if (index >= 0) {
    allLeads[index] = { ...lead, updatedAt: Date.now() };
  } else {
    // Ensure new leads are assigned
    if (!lead.assignedTo) {
        const user = getCurrentUser();
        lead.assignedTo = user.id;
    }
    allLeads.push({ ...lead, createdAt: Date.now(), updatedAt: Date.now() });
  }
  localStorage.setItem(LEADS_KEY, JSON.stringify(allLeads));
};

export const getTouches = (leadId: string): Touch[] => {
  const data = localStorage.getItem(TOUCHES_KEY);
  const allTouches: Touch[] = data ? JSON.parse(data) : [];
  return allTouches.filter(t => t.leadId === leadId).sort((a, b) => b.timestamp - a.timestamp);
};

export const addTouch = (touch: Omit<Touch, 'id' | 'timestamp'>): Touch => {
  const data = localStorage.getItem(TOUCHES_KEY);
  const allTouches: Touch[] = data ? JSON.parse(data) : [];
  
  const newTouch: Touch = {
    ...touch,
    id: generateId(),
    timestamp: Date.now()
  };

  allTouches.push(newTouch);
  localStorage.setItem(TOUCHES_KEY, JSON.stringify(allTouches));

  // Update Lead's stats in the main DB
  const leadsData = localStorage.getItem(LEADS_KEY);
  if (leadsData) {
      const leads: Lead[] = JSON.parse(leadsData);
      const leadIndex = leads.findIndex(l => l.id === touch.leadId);
      if (leadIndex >= 0) {
          const lead = leads[leadIndex];
          lead.lastTouchTimestamp = newTouch.timestamp;
          lead.lastTouchType = newTouch.type;
          lead.totalTouches = (lead.totalTouches || 0) + 1;
          
          if (lead.status === LeadStatus.NEW) {
              lead.status = LeadStatus.ATTEMPTED_CONTACT;
          }
          leads[leadIndex] = lead;
          localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
      }
  }

  return newTouch;
};

// Admin Only
export const deleteTouch = (touchId: string, leadId: string): void => {
    const data = localStorage.getItem(TOUCHES_KEY);
    let allTouches: Touch[] = data ? JSON.parse(data) : [];
    
    // Remove the touch
    const initialCount = allTouches.length;
    allTouches = allTouches.filter(t => t.id !== touchId);
    
    if (allTouches.length === initialCount) return; // Nothing deleted

    localStorage.setItem(TOUCHES_KEY, JSON.stringify(allTouches));

    // Recalculate Lead Stats
    const leadsData = localStorage.getItem(LEADS_KEY);
    if (leadsData) {
        const leads: Lead[] = JSON.parse(leadsData);
        const leadIndex = leads.findIndex(l => l.id === leadId);
        
        if (leadIndex >= 0) {
            const lead = leads[leadIndex];
            
            // Re-fetch only this lead's touches to find new latest
            const leadTouches = allTouches
                .filter(t => t.leadId === leadId)
                .sort((a, b) => b.timestamp - a.timestamp);

            lead.totalTouches = leadTouches.length;
            
            if (leadTouches.length > 0) {
                lead.lastTouchTimestamp = leadTouches[0].timestamp;
                lead.lastTouchType = leadTouches[0].type;
            } else {
                lead.lastTouchTimestamp = null;
                lead.lastTouchType = undefined;
                // Optionally revert status if it was ATTEMPTED_CONTACT and now 0 touches?
                // For now, we leave status as is to respect manual changes.
            }
            
            leads[leadIndex] = lead;
            localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
        }
    }
};

export const createLead = (
  borrowers: Omit<Borrower, 'id'>[],
  purpose: 'PURCHASE' | 'REFINANCE'
): Lead => {
    const user = getCurrentUser();
    const newBorrowers = borrowers.map(b => ({
        ...b,
        id: generateId()
    }));

    const newLead: Lead = {
        id: generateId(),
        assignedTo: user.id, // Assign to creator by default
        processorId: undefined,
        borrowers: newBorrowers,
        status: LeadStatus.NEW,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastTouchTimestamp: null,
        totalTouches: 0,
        nextFollowUp: null,
        loanParams: {
            loanAmount: 0,
            purchasePrice: 0,
            interestRate: 0,
            loanType: 'CONV',
            purpose,
            propertyType: PropertyType.SFH,
            propertyUse: PropertyUse.PRIMARY,
            state: '',
            zip: '',
            creditScore: 0
        },
        changeLog: []
    };
    saveLead(newLead);
    return newLead;
};

// --- DB MANAGEMENT ---

export const resetDatabase = () => {
    localStorage.removeItem(LEADS_KEY);
    localStorage.removeItem(TOUCHES_KEY);
    localStorage.removeItem(USERS_KEY);
    // Reload will trigger re-seeding
    window.location.reload();
};

export const getFullDatabase = () => {
    return {
        leads: JSON.parse(localStorage.getItem(LEADS_KEY) || '[]'),
        touches: JSON.parse(localStorage.getItem(TOUCHES_KEY) || '[]'),
        users: JSON.parse(localStorage.getItem(USERS_KEY) || '[]'),
        meta: {
            exportedAt: new Date().toISOString(),
            version: 'v1'
        }
    };
};
