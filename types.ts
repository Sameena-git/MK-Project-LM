
/**
 * BROKEROS DATABASE SCHEMA
 * 
 * RELATIONSHIPS:
 * - User (1) ----< (N) Lead
 * - Lead (1) ----< (N) Touch
 * - Lead (1) ----< (N) ChangeLogEntry
 * - Lead (1) ----< (1..4) Borrower (Embedded Array)
 * 
 * INDEXES (Recommended for Backend):
 * - Lead: [assignedTo, status, updatedAt] for Pipeline queries
 * - Touch: [leadId, timestamp] for History queries
 * - Borrower: [email, phone] for Duplicate Detection
 * - User: [email] for Auth
 */

export enum UserRole {
  LO = 'LOAN_OFFICER',
  ADMIN = 'ADMIN',
  PROCESSOR = 'PROCESSOR'
}

/**
 * [Table: Users]
 * System users (Loan Officers, Processors).
 */
export interface User {
  /** [PK] Unique User ID */
  id: string;
  /** [Required] [Index] Login Email */
  email: string;
  /** [Required] Display Name */
  name: string;
  /** [Required] Permission Level */
  role: UserRole;
  /** [Derived] Account creation timestamp */
  createdAt: number;
}

export enum LeadStatus {
  NEW = 'NEW',
  ATTEMPTED_CONTACT = 'ATTEMPTED_CONTACT',
  IN_COMMUNICATION = 'IN_COMMUNICATION',
  APPLICATION_TAKEN = 'APPLICATION_TAKEN',
  PROCESSING = 'PROCESSING',
  FUNDED = 'FUNDED',
  ARCHIVED = 'ARCHIVED',
  LOST = 'LOST'
}

export enum TouchType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  TEXT = 'TEXT',
  WHATSAPP = 'WHATSAPP',
  NOTE = 'NOTE',
  MEETING = 'MEETING'
}

export enum TouchOutcome {
  SPOKE = 'SPOKE',
  VOICEMAIL = 'VOICEMAIL',
  NO_ANSWER = 'NO_ANSWER',
  REPLIED = 'REPLIED',
  OPENED = 'OPENED',
  SENT = 'SENT',
  INTERNAL = 'INTERNAL' // For notes
}

export enum PropertyType {
  SFH = 'SFH',
  CONDO = 'CONDO',
  MULTI = 'MULTI_UNIT',
  TOWNHOUSE = 'TOWNHOUSE'
}

export enum PropertyUse {
  PRIMARY = 'PRIMARY',
  SECOND = 'SECOND_HOME',
  INVESTMENT = 'INVESTMENT'
}

export type ChangeReason = 'CORRECTION' | 'BORROWER_REQUEST' | 'SCENARIO_TEST' | 'OTHER';

/**
 * [Table: ChangeLog]
 * Append-only audit trail for Lead modifications.
 */
export interface ChangeLogEntry {
  /** [PK] Unique Log ID */
  id: string;
  /** [Required] [Index] When the change occurred */
  timestamp: number;
  /** [Required] The JSON key/path that changed */
  field: string;
  /** [Required] Previous value */
  oldValue: string | number;
  /** [Required] New value */
  newValue: string | number;
  /** [Required] Context for the change */
  reason: ChangeReason;
  /** [Optional] [Editable] User provided note */
  comment?: string;
  /** [Required] Name of user who made change */
  changedBy: string;
}

/**
 * [Table: Touches]
 * Interaction history. Immutable once created.
 */
export interface Touch {
  /** [PK] Unique Touch ID */
  id: string;
  /** [FK] [Index] Link to Parent Lead */
  leadId: string;
  /** [Required] Channel of communication */
  type: TouchType;
  /** [Required] Result of communication */
  outcome: TouchOutcome;
  /** [Required] [Editable] The actual log/note */
  content: string; 
  /** [Required] [Index] When it happened */
  timestamp: number;
  /** [Required] User who performed action */
  createdBy: string;
}

/**
 * [Embedded Object]
 * Financials and Scenarios. 
 * 1:1 relationship with Lead.
 */
export interface LoanParams {
  /** [Required] [Editable] Target Loan Amount */
  loanAmount: number;
  /** [Required] [Editable] Purchase Price or Estimated Value */
  purchasePrice: number; 
  /** [Required] [Editable] Interest Rate (Target or Locked) */
  interestRate: number; 
  /** [Required] [Editable] Program Type */
  loanType: 'CONV' | 'FHA' | 'VA' | 'JUMBO' | 'DSCR' | 'USDA';
  /** [Required] [Editable] Goal of the loan */
  purpose: 'PURCHASE' | 'REFINANCE' | 'HELOC';
  /** [Required] [Editable] Subject Property Type */
  propertyType: PropertyType;
  /** [Required] [Editable] Subject Property Occupancy */
  propertyUse: PropertyUse;
  /** [Optional] [Editable] Property State */
  state: string;
  /** [Optional] [Editable] Property Zip */
  zip: string;
  /** [Optional] [Editable] Primary Borrower FICO */
  creditScore: number;
}

/**
 * [Embedded Object]
 * People on the loan.
 * 1:N relationship with Lead (Max 4).
 */
export interface Borrower {
  /** [PK] Internal ID for UI stability */
  id: string;
  /** [Required] [Editable] First Name */
  firstName: string;
  /** [Required] [Editable] Last Name */
  lastName: string;
  /** [Optional] [Editable] [Index] Email Address */
  email: string;
  /** [Optional] [Editable] [Index] Phone Number */
  phone: string;
  /** [Required] [Editable] Is this the main point of contact? */
  isPrimary: boolean;
}

/**
 * [Table: Leads]
 * The core entity of the system.
 */
export interface Lead {
  /** [PK] Unique Lead ID */
  id: string;
  
  /** [FK] [Index] User ID of the Loan Officer owning this file (Primary Owner) */
  assignedTo?: string;

  /** [FK] [Optional] User ID of the Processor assigned to this file */
  processorId?: string;

  /** [Required] Embedded Array of Borrowers (Min 1) */
  borrowers: Borrower[]; 
  
  /** [Required] [Editable] [Index] Pipeline Stage */
  status: LeadStatus;
  
  /** [Derived] Timestamp of creation */
  createdAt: number;
  
  /** [Derived] Timestamp of last edit */
  updatedAt: number;
  
  /** [Derived] Timestamp of last Touch. Used for Stale logic. */
  lastTouchTimestamp: number | null;

  /** [Derived] Type of the last touch. */
  lastTouchType?: TouchType;
  
  /** [Derived] Total number of touches logged. */
  totalTouches: number;
  
  /** [Editable] Planned future follow-up */
  nextFollowUp: number | null;
  
  /** [Required] Embedded Loan Scenario */
  loanParams: LoanParams;
  
  /** [Required] Embedded Audit Trail */
  changeLog: ChangeLogEntry[];
}
