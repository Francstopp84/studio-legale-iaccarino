import { NextRequest, NextResponse } from "next/server";
import { tutorChatAI } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const { message, history, pageContext } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Messaggio mancante" }, { status: 400 });
    }

    const reply = await tutorChatAI(message, history || [], pageContext);
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Tutor API error:", error);
    return NextResponse.json(
      { error: error.message || "Errore interno del tutor" },
      { status: 500 }
    );
  }
}
