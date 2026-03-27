import { GoogleGenAI } from "@google/genai"

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export function getGeminiClient() {
  return client
}

export const GEMINI_MODEL = "gemini-2.5-flash"