import { NextRequest } from "next/server";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini-client";

export async function POST(req: NextRequest) {
    const { tasks, scope } = await req.json();

    if (!tasks?.length) {
        return Response.json({ summary: "// no tasks to summarise" });
    }

    const todayLabel = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).toLowerCase();

    const taskList = tasks
        .map((t: any) =>
            `- [${t.done ? "done" : "pending"}] [${t.priority}] ${t.title}${
                t.notes ? ` (${t.notes})` : ""
            }`
        )
        .join("\n");

    const prompt =
        `You are a personal productivity assistant. Today is ${todayLabel}.
 
Here are the user's ${scope} tasks:
${taskList}
 
Write a brief, encouraging summary (3-5 sentences max) that:
- Highlights what was accomplished if any tasks are done
- Notes the most important pending items (especially high priority)
- Gives a motivational closing line
- Sounds human and natural, not robotic
- Uses lowercase, conversational tone matching a minimal productivity app
 
Do not use bullet points. Write in flowing prose. Keep it under 80 words.`;

    try {
        const gemini = getGeminiClient();
        const result = await gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        });
        const text = result.text;
        if (!text) {
            throw new Error("Gemini returned empty response");
        }
        const summary = text.trim();
        return Response.json({ summary });
    } catch (err) {
        console.error("[summarize]", err);
        return Response.json({ summary: "// summary unavailable right now" });
    }
}
