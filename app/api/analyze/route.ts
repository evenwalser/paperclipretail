// /app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { Configuration, OpenAIApi } from "openai";

interface TogetherAIResponse {
  title?: string;
  description?: string;
  price_avg?: number;
  category_id?: string;
  condition?: "New" | "Like New" | "Very Good" | "Good" | "Fair";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageUrl = formData.get("image_url");
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "No image URL provided" }, { status: 400 });
    }
    console.log("Analyzing image at URL:", imageUrl);

    // Instead of sending a full base64 string, we use the URL in the prompt.
    const prompt = `You are a retail expert. Analyze the image available at this URL: ${imageUrl}.
Based on the image, output a JSON object with the following keys:
  - "title": a suggested title,
  - "description": a brief description,
  - "price_avg": an estimated price (number),
  - "category_id": a simulated UUID for a valid category,
  - "condition": one of "New", "Like New", "Very Good", "Good", or "Fair".
Output only valid JSON.`;

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant that returns JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const resultText = completion.data.choices[0]?.message?.content;
    if (!resultText) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    let result: TogetherAIResponse;
    try {
      result = JSON.parse(resultText);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return NextResponse.json({ error: "Failed to parse analysis response" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}

