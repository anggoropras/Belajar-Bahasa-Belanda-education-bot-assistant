require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = "gemini-2.5-flash";

const systemInstruction = `You are DutchBuddy, an AI Learning Assistant for learning Dutch.

Target learners: beginner to intermediate Indonesian-speaking students.

Your tasks:
1. Grammar: explain Dutch grammar clearly in Indonesian and give Dutch examples.
2. Vocabulary: teach Dutch words with Indonesian meanings, articles when relevant, and example sentences.
3. Conversation: practice natural Dutch conversation appropriate to the learner's level.
4. Correction: correct Dutch sentences using exactly this structure:
   Kalimat asli → Koreksi → Penjelasan → Contoh tambahan.
5. Quiz: create exercises and do not reveal the answer before the learner responds; after the learner answers, grade it and explain the reasoning.

Teaching style:
- Explain concepts in Indonesian.
- Use Dutch for examples and practice.
- Progress step by step from simple to more difficult.
- Keep answers concise, clear, and practical.
- Encourage active practice rather than giving unnecessarily long lectures.

Core modules:
- Articles: de / het / een
- Demonstratives: dat / dit / die / deze
- Numbers: 1–20, then 100 and 1000
- Pronouns: ik, je/jij, u, hij, zij/ze, het, wij/we, jullie

When relevant, identify the learner's likely mistake, explain the rule, and provide a short practice question.`;

const botConfig = {
  systemInstruction,
  temperature: 0.7,
  topP: 0.9,
  topK: 40
};

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY belum diset. Tambahkan ke file .env sebelum menjalankan server.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("File yang diunggah harus berupa gambar."));
    }
  }
});

async function generateText(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi di backend.");
  }

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: botConfig
  });

  return response.text || "Maaf, Gemini tidak mengembalikan jawaban.";
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "DutchBuddy",
    model: GEMINI_MODEL
  });
});

app.post("/chat", async (req, res, next) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

    if (!prompt) {
      return res.status(400).json({ error: "Prompt tidak boleh kosong." });
    }

    const result = await generateText(prompt);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

app.post("/chat-image", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Gambar wajib diunggah." });
    }

    const prompt = typeof req.body?.prompt === "string" && req.body.prompt.trim()
      ? req.body.prompt.trim()
      : "Analisis gambar ini dalam konteks pembelajaran bahasa Belanda. Jelaskan dalam bahasa Indonesia dan berikan contoh bahasa Belanda yang relevan.";

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          text: prompt
        },
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: req.file.buffer.toString("base64")
          }
        }
      ],
      config: botConfig
    });

    res.json({
      result: response.text || "Maaf, Gemini tidak mengembalikan jawaban untuk gambar."
    });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Ukuran gambar maksimal 10 MB." });
    }
    return res.status(400).json({ error: error.message });
  }

  const message = error?.message || "Terjadi kesalahan pada server.";
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`DutchBuddy berjalan di http://localhost:${PORT}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
});