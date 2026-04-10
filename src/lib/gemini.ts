import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuizConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateAll = async (config: QuizConfig): Promise<{ questions: Question[]; flashcards: { front: string; back: string }[] }> => {
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          {
            text: `You are an expert educator. Generate a high-quality quiz with exactly ${config.questionCount} questions AND 10 flashcards.
            Topic: ${config.topic}
            Level: ${config.level}
            Language: ${config.language}
            Additional Materials: ${config.additionalMaterials || "None provided"}
            
            QUIZ INSTRUCTIONS:
            1. Analyze any provided images or documents (PDFs/PPTs) to extract relevant facts, diagrams, or text.
            2. Generate questions that are syllabus-accurate for the ${config.level} level.
            3. Use Google Search to verify facts and ensure the questions match current academic standards.
            4. Exactly 20% of the questions MUST be of type "writing" (e.g., if there are 5 questions, 1 MUST be writing). The rest MUST be "multiple_choice".
            5. For "multiple_choice" questions:
               - Must have exactly 4 options and 1 correct answer.
               - Randomize the position of the correct answer among the 4 options.
            6. For "writing" questions:
               - The answer should be a specific fact or a short word (1-3 words max).
               - The "options" array should be empty.
            7. Provide a detailed explanation for the correct answer.
            
            FLASHCARD INSTRUCTIONS:
            1. Create clear, concise "Front" (Question/Term) and "Back" (Answer/Definition) pairs.
            2. Focus on key concepts, definitions, and important facts.
            
            MANDATORY: All text content MUST be written entirely in the specified language: ${config.language}.
            Return the response in the specified JSON format.`
          },
          ...(config.images?.map(img => ({
            inlineData: {
              data: img.split(',')[1],
              mimeType: "image/jpeg"
            }
          })) || []),
          ...(config.documents?.map(doc => ({
            inlineData: {
              data: doc.data.split(',')[1],
              mimeType: doc.mimeType
            }
          })) || [])
        ]
      }
    ],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["multiple_choice", "writing"] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["question", "type", "options", "correctAnswer", "explanation"]
            }
          },
          flashcards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING }
              },
              required: ["front", "back"]
            }
          }
        },
        required: ["questions", "flashcards"]
      }
    }
  });

  const response = await model;
  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  const data = JSON.parse(text.trim());
  
  return {
    questions: data.questions.map((q: any) => ({
      ...q,
      options: [...q.options].sort(() => Math.random() - 0.5)
    })),
    flashcards: data.flashcards
  };
};

export const analyzeImage = async (base64Image: string): Promise<string> => {
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          { text: "Analyze this image and extract any relevant educational content, text, or diagrams that could be used for a quiz." },
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: "image/jpeg"
            }
          }
        ]
      }
    ]
  });

  const response = await model;
  return response.text || "";
};
