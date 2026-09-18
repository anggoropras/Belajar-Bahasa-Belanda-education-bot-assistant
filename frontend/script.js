/*
 * DutchBuddy — frontend client
 * Security: Gemini API key must NEVER be placed in this file.
 *
 * TODO (production): replace localhost with the deployed backend origin,
 * ideally through a deployment config/environment injected at build time.
 */
const API_URL = "http://localhost:3000";

const chatForm = document.querySelector("#chat-form");
const userInput = document.querySelector("#user-input");
const chatBox = document.querySelector("#chat-box");
const sendButton = document.querySelector("#send-button");
const imageButton = document.querySelector("#image-button");
const imageInput = document.querySelector("#image-input");
const filePreview = document.querySelector("#file-preview");

const DUTCHBUDDY_SYSTEM_PROMPT = `
Kamu adalah DutchBuddy, AI Learning Assistant khusus untuk membantu pengguna belajar Bahasa Belanda.
Target pengguna: pelajar Bahasa Belanda tingkat pemula hingga menengah, terutama pembelajar berbahasa Indonesia.

Lima tugas utama:
1. Grammar: menjelaskan tata bahasa Bahasa Belanda secara konseptual dan praktis.
2. Vocabulary: memperkenalkan kosakata, arti, penggunaan, dan contoh.
3. Percakapan: melatih dialog Bahasa Belanda secara bertahap.
4. Koreksi kesalahan: mengoreksi kalimat pengguna dan menjelaskan alasannya.
5. Membuat kuis: membuat latihan interaktif sesuai materi.

Gaya pengajaran:
- Jelaskan konsep utama dalam Bahasa Indonesia.
- Gunakan contoh Bahasa Belanda yang relevan.
- Ajarkan bertahap dari konsep sederhana ke penerapan.
- Untuk pertanyaan sederhana, jawab ringkas dan langsung.
- Jangan mengarang fakta tentang materi jika tidak diperlukan.
- Gunakan format yang mudah dibaca.

Format koreksi kalimat wajib:
Kalimat asli → Koreksi → Penjelasan → Contoh tambahan.

Aturan kuis:
- Jangan langsung memberi jawaban.
- Beri soal terlebih dahulu dan tunggu respons pengguna.
- Setelah pengguna menjawab, nilai dan jelaskan jawabannya.
- Variasikan pilihan ganda, isian, dan penerjemahan jika sesuai.

Materi fokus DutchBuddy:
1. Articles: de / het / een, dengan contoh de hond, het huis, een paard.
2. Demonstratives: dat / dit / die / deze.
3. Numbers: 1–20, lalu pola hingga 100 dan 1000.
4. Pronomina orang: ik, je/jij, u, hij, zij/ze, het, wij/we, jullie.

Tujuan pembelajaran: membantu pengguna memahami Bahasa Belanda, berlatih secara aktif, dan menerima umpan balik yang jelas.
`;

function buildPrompt(userMessage) {
  return `${DUTCHBUDDY_SYSTEM_PROMPT}

Instruksi pengguna:
${userMessage}

Jawab sebagai DutchBuddy. Fokus pada tujuan belajar dan materi Bahasa Belanda yang relevan.`;
}

function hideWelcome() {
  const welcome = document.querySelector("#welcome-screen");
  if (welcome) welcome.remove();
}

function appendMessage(sender, text) {
  hideWelcome();

  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${sender}`;
  bubble.textContent = text;

  row.appendChild(bubble);
  chatBox.appendChild(row);
  scrollToBottom();
  return row;
}

function showTyping() {
  hideWelcome();

  const row = document.createElement("div");
  row.className = "message-row bot";
  row.id = "typing-indicator";

  const bubble = document.createElement("div");
  bubble.className = "bubble bot typing-bubble";
  bubble.setAttribute("aria-label", "DutchBuddy sedang mengetik");

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "typing-dot";
    bubble.appendChild(dot);
  }

  row.appendChild(bubble);
  chatBox.appendChild(row);
  scrollToBottom();
}

function removeTyping() {
  document.querySelector("#typing-indicator")?.remove();
}

function setLoading(isLoading) {
  sendButton.disabled = isLoading;
  userInput.disabled = isLoading;
  imageButton.disabled = isLoading;
  if (!isLoading) userInput.focus();
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setInputPrompt(prompt) {
  userInput.value = prompt;
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
  userInput.focus();
}

function handleTopic(topic) {
  const prompts = {
    grammar: "Ajarkan saya grammar Bahasa Belanda untuk pemula dengan fokus articles de/het/een. Jelaskan bertahap dan beri latihan.",
    vocabulary: "Ajarkan 10 kosakata Bahasa Belanda yang relevan untuk pemula. Sertakan arti Bahasa Indonesia, artikel jika berupa kata benda, dan contoh kalimat.",
    quiz: "Buat kuis Bahasa Belanda 5 soal berdasarkan articles, demonstratives, numbers, dan pronouns. Jangan langsung beri jawaban.",
    chat: ""
  };
  setInputPrompt(prompts[topic] ?? "");
}

async function sendMessage(message) {
  appendMessage("user", message);
  setLoading(true);
  showTyping();

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: buildPrompt(message) })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Backend merespons HTTP ${response.status}`);
    if (!data.result) throw new Error("Backend tidak mengembalikan result.");

    removeTyping();
    appendMessage("bot", data.result);
  } catch (error) {
    removeTyping();
    appendMessage("bot", `Maaf, DutchBuddy belum dapat memproses pesan ini. ${error.message}\n\nPastikan backend berjalan di localhost:3000 dan endpoint /chat tersedia.`);
  } finally {
    setLoading(false);
  }
}

async function sendImage(file) {
  if (!file) return;

  hideWelcome();
  appendMessage("user", `Gambar dikirim: ${file.name}`);
  setLoading(true);
  showTyping();

  const formData = new FormData();
  formData.append("image", file);
  formData.append(
    "prompt",
    `${DUTCHBUDDY_SYSTEM_PROMPT}

Analisis gambar berikut untuk tujuan edukasi Bahasa Belanda.
Jika gambar berisi teks, identifikasi dan jelaskan teks tersebut.
Jika berisi objek atau situasi, gunakan sebagai bahan kosakata, grammar, atau conversation practice.
Jelaskan dalam Bahasa Indonesia dan berikan contoh Bahasa Belanda.
Jangan mengarang detail visual yang tidak terlihat.
`
  );

  try {
    const response = await fetch(`${API_URL}/chat-image`, {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Backend merespons HTTP ${response.status}`);
    if (!data.result) throw new Error("Backend tidak mengembalikan result.");

    removeTyping();
    appendMessage("bot", data.result);
  } catch (error) {
    removeTyping();
    appendMessage("bot", `Maaf, analisis gambar gagal. ${error.message}\n\nPastikan backend berjalan di localhost:3000, endpoint /chat-image tersedia, dan konfigurasi upload gambar backend benar.`);
  } finally {
    setLoading(false);
    imageInput.value = "";
    filePreview.hidden = true;
    filePreview.textContent = "";
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = userInput.value.trim();
  if (!message || sendButton.disabled) return;

  userInput.value = "";
  userInput.style.height = "auto";
  await sendMessage(message);
});

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
});

document.querySelectorAll("[data-prompt]").forEach((element) => {
  element.addEventListener("click", () => {
    setInputPrompt(element.dataset.prompt || "");
  });
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
    item.classList.add("active");
    handleTopic(item.dataset.topic);
  });
});

imageButton.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;

  filePreview.hidden = false;
  filePreview.textContent = `Gambar dipilih: ${file.name}`;
  sendImage(file);
});

window.addEventListener("load", () => userInput.focus());
