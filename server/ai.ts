import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { portfolioData } from "../src/data/portfolio";

const getAI = (apiKey?: string) => {
  const key = apiKey || process.env.GEMINI_API_KEY || "";
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey: key });
};

export const generateTextResponse = async (
  history: any[],
  prompt: string,
  images: string[] = [],
  useThinking: boolean = false,
  apiKey?: string
) => {
  const ai = getAI(apiKey);
  const modelId = "gemini-3.1-pro-preview";
  
  const systemInstruction = `
    I am Gemini, a large language model built by Google.
    In this chat, I am acting as Sonu Parsad's personal **portfolio assistant**.
    My goal is to help visitors organize, build, or improve their understanding of Sonu's work, or discuss portfolios in general.
    
    Here is the context about Sonu Parsad:
    - Name: ${portfolioData.name}
    - Role: ${portfolioData.role}
    - Education: ${portfolioData.education.degree} in ${portfolioData.education.major} at ${portfolioData.education.institution} (${portfolioData.education.duration}). Key areas: ${portfolioData.education.keyAreas.join(", ")}.
    - Career Objective: ${portfolioData.careerObjective}
    - Skills: 
      - Languages: ${portfolioData.skills.programmingLanguages.map(l => `${l.name} (${l.level})`).join(", ")}
      - Fundamentals: ${portfolioData.skills.csFundamentals.join(", ")}
      - Current Focus: ${portfolioData.skills.currentFocus.join(", ")}
    - Projects:
      ${portfolioData.projects.map(p => `- ${p.title} (${p.category}): ${p.description}. Tech: ${p.tech.join(", ")}`).join("\n")}
    - Contact: Email: ${portfolioData.contact.email}, GitHub: ${portfolioData.contact.github}, LinkedIn: ${portfolioData.contact.linkedin}

    I can also perform tasks like analyzing images, generating code, or creating content.
    If the user asks about my capabilities, I should mention I can generate images and videos using Veo and Gemini models.
  `;
  
  const config: any = {
    systemInstruction,
  };

  if (useThinking) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  const chat = ai.chats.create({
    model: modelId,
    config,
    history: history.map(h => ({
      role: h.role === "user" ? "user" : "model",
      parts: [
        { text: h.content || h.text },
        ...(h.images ? (typeof h.images === 'string' ? JSON.parse(h.images) : h.images) : []).map((img: string) => ({ 
          inlineData: { mimeType: "image/png", data: img.includes(",") ? img.split(",")[1] : img } 
        }))
      ],
    })),
  });

  const parts: any[] = [{ text: prompt }];
  images.forEach(img => {
    parts.push({ inlineData: { mimeType: "image/png", data: img.includes(",") ? img.split(",")[1] : img } });
  });

  const result = await chat.sendMessage({
    message: parts
  });

  return result.text;
};

export const generateImage = async (prompt: string, aspectRatio: string = "1:1", apiKey?: string) => {
  const ai = getAI(apiKey);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: "1K"
      }
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateVideo = async (prompt: string, image?: string, aspectRatio: string = "16:9", apiKey?: string) => {
  const ai = getAI(apiKey);

  const model = 'veo-3.1-fast-generate-preview';
  
  const request: any = {
    model,
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio as any
    }
  };

  if (image) {
    request.image = {
      imageBytes: image.includes(",") ? image.split(",")[1] : image,
      mimeType: 'image/png'
    };
  }

  let operation = await ai.models.generateVideos(request);

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("No video generated");

  return videoUri; // Return the URI, frontend will fetch it or we can proxy it
};
