import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuizConfig } from "../types";

const getAI = () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined. AI features will be disabled.');
      return null;
    }
    return new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error('Failed to initialize GoogleGenAI:', e);
    return null;
  }
};

const ai = getAI();

export const generateAll = async (config: QuizConfig): Promise<{ questions: Question[]; flashcards: { front: string; back: string }[] }> => {
  if (!ai) {
    throw new Error('Gemini API Key is missing. Please configure it in Settings.');
  }
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
            3. Use Google Search to find real, specific Cambridge IGCSE or A-Level past paper questions related to the topic. If possible, replicate the exact wording and data from these papers.
            4. For "exam" type:
               - Mimic the style of "Cambridge Testmaker" or official IGCSE/A-Level past papers.
               - Use formal exam language (e.g., "The diagram shows...", "Calculate...", "State...", "Explain...").
               - **DIAGRAMS & GRAPHS**: If a question involves a graph (speed-time, distance-time, supply-demand), a circuit, a geometric shape, or a simple biological diagram, you MUST generate a clean, high-quality SVG code in the "diagram" field.
               - **BE CREATIVE**: Use SVG to create visually engaging diagrams that help explain the problem. Use colors for clarity but keep it professional.
               - The SVG should be responsive (use viewBox, no fixed width/height), use a white/transparent background, and have clear labels in the specified language.
               - If no diagram is needed, leave the "diagram" field empty.
               - Split complex multi-part questions into individual questions in the JSON array, but prefix them clearly (e.g., "1(a) Calculate the deceleration...", "1(b) Calculate the total distance...").
               - Include mark indications in the "marks" field (e.g., 1, 2, 3).
               - Focus on structured problem solving, data interpretation, and multi-step calculations.
            5. Exactly 20% of the questions MUST be of type "writing" (e.g., if there are 5 questions, 1 MUST be writing). The rest MUST be "multiple_choice".
            6. For "multiple_choice" questions:
               - Must have exactly 4 options and 1 correct answer.
               - **PLAUSIBLE DISTRACTORS**: The incorrect options (distractors) MUST be plausible, related to the topic, and similar in length and complexity to the correct answer. Avoid making the correct answer stand out by its length or detail.
               - Randomize the position of the correct answer among the 4 options.
            6. For "writing" questions:
               - The answer should be a specific fact or a short word (1-3 words max).
               - The "options" array should be empty.
               - **ACCEPTABLE ANSWERS**: Provide an array of alternate valid answers in the "acceptableAnswers" field. This is CRITICAL for languages with suffixes (like Uzbek: "Xurshid", "Xurshidning", "Xurshidni") or synonyms. Include all common linguistic variations or short-form/long-form synonyms.
            7. Provide a detailed explanation for the correct answer.
            8. Assign marks to each question (1-5 marks depending on complexity).
            
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
                acceptableAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
                explanation: { type: Type.STRING },
                marks: { type: Type.NUMBER },
                diagram: { type: Type.STRING }
              },
              required: ["question", "type", "options", "correctAnswer", "explanation", "marks", "acceptableAnswers"]
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
  if (!ai) {
    throw new Error('Gemini API Key is missing. Please configure it in Settings.');
  }
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
