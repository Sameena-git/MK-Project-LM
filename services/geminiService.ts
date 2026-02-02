import { GoogleGenAI, Type } from "@google/genai";
import { Touch, Lead } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to format touches for context
const formatHistory = (touches: Touch[]): string => {
  return touches.slice(0, 10).map(t => 
    `[${new Date(t.timestamp).toLocaleDateString()}] ${t.type} (${t.outcome}): ${t.content}`
  ).join('\n');
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
    console.error("Gemini Error:", error);
    return "AI Summary unavailable (Check API Key).";
  }
};

export const suggestNextAction = async (lead: Lead, touches: Touch[]): Promise<{action: string, rationale: string}> => {
    try {
        const history = formatHistory(touches);
        const borrowersList = lead.borrowers.map(b => `${b.firstName} ${b.lastName}`).join(' and ');

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Based on this mortgage lead history, suggest the SINGLE best next action.
                Lead: ${borrowersList} (${lead.status})
                History: ${history}
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { type: Type.STRING, description: "The specific action (e.g., 'Call to lock rate', 'Send pre-approval letter')" },
                        rationale: { type: Type.STRING, description: "Why this is the right move now." }
                    }
                }
            }
        });
        
        const json = JSON.parse(response.text || "{}");
        return json;
    } catch (e) {
        return { action: "Review File manually", rationale: "AI unavailable" };
    }
}
