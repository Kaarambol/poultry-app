import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const texts: string[] = Array.isArray(body.texts) ? body.texts : [];
    const targetLang: string = String(body.targetLang || "en");

    if (texts.length === 0) {
      return NextResponse.json({ translations: texts });
    }

    const translations: string[] = [];

    for (const text of texts) {
      if (!text || !text.trim()) {
        translations.push(text);
        continue;
      }
      try {
        // autodetect source language so any language gets translated to target
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${targetLang}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await r.json();
        const translated = data?.responseData?.translatedText;
        translations.push(typeof translated === "string" ? translated : text);
      } catch {
        translations.push(text);
      }
    }

    return NextResponse.json({ translations });
  } catch (error) {
    console.error("FORUM TRANSLATE ERROR:", error);
    return NextResponse.json({ error: "Translation failed." }, { status: 500 });
  }
}
