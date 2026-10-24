
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Only POST requests are allowed."
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI service is not configured. Add OPENROUTER_API_KEY in Vercel."
    });
  }

  try {
    const { message = "", image = null, history = [] } = req.body || {};

    if (!String(message).trim() && !image) {
      return res.status(400).json({
        error: "Enter a message or attach an image."
      });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are MAGGPT, a helpful AI assistant created by Dev Joshua. " +
          "Help users with learning, writing, coding, maths, physics, chemistry, " +
          "and general questions. When an image is provided, examine it carefully. " +
          "For school problems, explain the solution step by step. " +
          "Be honest if you cannot read an image clearly."
      }
    ];

    if (Array.isArray(history)) {
      for (const item of history.slice(-10)) {
        if (
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        ) {
          messages.push({
            role: item.role,
            content: item.content.slice(0, 8000)
          });
        }
      }
    }

    if (image) {
      if (
        typeof image !== "string" ||
        !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(image)
      ) {
        return res.status(400).json({
          error: "Unsupported image format. Use JPEG, PNG, WEBP, or GIF."
        });
      }

      if (image.length > 12_000_000) {
        return res.status(413).json({
          error: "Image is too large. Please choose a smaller picture."
        });
      }

      const userContent = [];

      userContent.push({
        type: "text",
        text: String(message).trim() ||
          "Please examine this image and explain what it shows. If it contains a school problem, solve it step by step."
      });

      userContent.push({
        type: "image_url",
        image_url: {
          url: image
        }
      });

      messages.push({
        role: "user",
        content: userContent
      });
    } else {
      messages.push({
        role: "user",
        content: String(message).slice(0, 8000)
      });
    }

    const aiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mag-gpt.vercel.app",
          "X-Title": "MAGGPT"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages,
          temperature: 0.7,
          max_tokens: 1200
        })
      }
    );

    const result = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("OpenRouter error:", result);

      return res.status(502).json({
        error:
          result?.error?.message ||
          "The AI provider could not process your request. Please try again."
      });
    }

    const reply = result?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "The AI returned an empty response. Please try again."
      });
    }

    return res.status(200).json({
      reply: reply.trim()
    });
  } catch (error) {
    console.error("MAGGPT backend error:", error);

    return res.status(500).json({
      error: "Something went wrong while contacting the AI service."
    });
  }
}
