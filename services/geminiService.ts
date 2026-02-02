import { GoogleGenAI, Type } from "@google/genai";
import { Touch, Lead } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to format touches for context
const formatHistory = (touches: Touch[]): string => {
  return touches.slice(0, 10).map(t => 
    `[${new Date(t.timestamp).toLocaleDateString()}] ${t.type} (${t.outcome}): ${t.content}`
  ).join('\n');
};

const handleGeminiError = (error: any): string => {
  const isRateLimit = 
    error?.status === 429 || 
    error?.code === 429 || 
    error?.error?.code === 429 || 
    (error?.message && error.message.includes('429')) ||
    (error?.message && error.message.includes('quota'));

  if (isRateLimit) {
    console.warn("Gemini Rate Limit Exceeded");
    return "AI Usage Limit Reached. Please try again later.";
  }

  console.error("Gemini Error:", error);
  return "AI Service Unavailable.";
};

export const generateLeadSummary = async (lead: Lead, touches: Touch[]): Promise<string> => {
  if (touches.length === 0) return "No interaction history available.";

  const history = formatHistory(touches);
  const borrowersList = lead.borrowers.map(b => `${b.firstName} ${b.lastName}`).join(' and ');
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        You are a highly efficient mortgage assistant. 
        Analyze the following interaction history for lead(s): ${borrowersList}.
        
        Loan Purpose: ${lead.loanParams.purpose}
        Loan Amount: $${lead.loanParams.loanAmount}
        
        Interaction History:
        ${history}

        Task: Provide a 2-sentence summary of the current situation. 
        1. What is the borrower's main hesitation or motivation?
        2. What is the immediate next step for the broker?
        
        Keep it professional, concise, and actionable.
      `,
    });
    return response.text || "Could not generate summary.";
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const suggestNextAction = async (lead: Lead, touches: Touch[]): Promise<{action: string, rationale: string}> => {
    try {
        const history = formatHistory(touches);
        const borrowersList = lead.borrowers.map(b => `${b.firstName} ${b.lastName}`).join(' and ');

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `
                You are a senior mortgage strategist. Based on this lead history, determine the SINGLE best strategic move to close this loan.
                Lead: ${borrowersList}
                Status: ${lead.status}
                Loan: ${lead.loanParams.purpose} $${lead.loanParams.loanAmount} at ${lead.loanParams.interestRate}%
                History: ${history}
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { type: Type.STRING, description: "The specific action (e.g., 'Call to lock rate', 'Send pre-approval letter')" },
                        rationale: { type: Type.STRING, description: "Why this move is strategically sound based on the history." }
                    }
                }
            }
        });
        
        const text = response.text || "{}";
        const json = JSON.parse(text);
        return {
            action: json.action || "Continue regular follow-up",
            rationale: json.rationale || "Maintain momentum until borrower makes a decision."
        };
    } catch (e) {
        const msg = handleGeminiError(e);
        return { action: "Review Required", rationale: msg };
    }
}