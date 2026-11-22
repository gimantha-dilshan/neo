# Neo - WhatsApp AI Chatbot 🤖✨

**Neo** is a sleek, intelligent, and general-purpose WhatsApp AI chatbot powered by Google Gemini and `@whiskeysockets/baileys`. It works smoothly in both private direct messages (DMs) and WhatsApp group chats.

---

## ⚡ Key Features

- **🎯 Dot Command Prefix (`.`):** Neo only responds to messages that start with `.`. Regular chatter in groups or DMs without `.` is ignored, keeping groups completely clutter-free.
- **👥 Advanced Group Chat Support:**
  - **Identifies Users Separately:** Each member in a group has their own isolated context.
  - **Unified User Memory:** If a user talks to Neo in private DMs and also uses Neo in a group chat, Neo recognizes them as the same person and links their conversation history seamlessly!
  - **Auto-Quotes & Mentions:** In group chats, replies quote the specific trigger message and mention the user so everyone knows who Neo is answering.
- **📸 Intelligent Vision Support:**
  - Send an image with a caption starting with `.` (e.g. `.What is this plant?`).
  - Reply / mention an already sent image with `.` (e.g. `.Explain what is in this picture`).
  - Images without captions are ignored.
- **💬 General Conversational AI:** Capable of answering any general question, programming inquiries, writing tasks, summaries, and casual chat.
- **🔄 8-Tier Dual-Key Failover:** Automatically cycles across 4 models (`gemini-2.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-2.5-flash-lite`) and repeats across your backup API key for near 100% uptime.
- **💾 Memory & Persistence:** Context-aware conversations with automatic local in-memory fallback and optional Supabase cloud history.
- **📱 Pairing Code Login:** Effortlessly pair with WhatsApp using a phone number pairing code (no QR scanning camera required).

---

## 🚀 Setup & Installation

### 1. Prerequisites
- Node.js 18+ installed

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Edit `.env`:
```env
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_API_KEY_2=your_optional_backup_gemini_api_key
BOT_NUMBER=94771234567 # Your WhatsApp number with country code
# Optional: Supabase for cloud history persistence
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_service_role_key
```

### 4. Start the Bot
```bash
npm start
```
Upon startup, if not already paired, Neo will generate an 8-character pairing code in your terminal. Enter it in WhatsApp:
**WhatsApp > Linked Devices > Link a Device > Link with phone number instead**.

---

## 💡 How to Use

| Command | Action |
|---|---|
| `.<question>` | Ask Neo anything in DM or Group (e.g., `.Explain quantum computing simply`) |
| `.c4` / `.cgf` | Open Connect Four menu with instructions & commands |
| `.c4 start` | Start or join a 2-player Connect Four match in group |
| `.c4 bot` | Play solo Connect Four against Neo AI (works in DMs & groups) |
| `1-7` or `.1-.7` | Drop your disc into column 1–7 during your turn |
| `.ttt` | Open Tic-Tac-Toe menu with instructions & commands |
| `.ttt start` | Start or join a 2-player Tic-Tac-Toe match in group |
| `.ttt bot` | Play solo Tic-Tac-Toe against Neo AI (works in DMs & groups) |
| `1-9` or `.1-.9` | Place your mark on the Tic-Tac-Toe board during your turn |
| `.wcg` | Open Word Chain Game menu with instructions & rules |
| `.wcg start` | Start a new Word Chain lobby in group (or force-start when 2+ joined) |
| `join` | Join an open Word Chain Game lobby |
| `<word>` | Submit an English word starting with the target letter |
| `.wcg stats` | View current Word Chain game statistics and progress |
| `stop` / `.stop` / `end` | Stop and terminate any active game (works with or without dot) |
| `surrender` / `.surrender` | Forfeit your active game (Connect Four, Tic-Tac-Toe, or Word Chain) |
| `.draw <prompt>` | Generate an AI image (e.g., `.draw an astronaut cat on Mars`) |
| `.generate <prompt>` | Generate an AI image (e.g., `.generate cyberpunk neon city`) |
| `[Image]` with `.<caption>` | Analyze or describe the attached image |
| Reply to `[Image]` with `.<text>` | Analyze the quoted/mentioned image |
| `.` | Quick start & welcome card with bot avatar |
| `.help` / `.menu` | Display rich visual image menu with complete command list |
| `.ping` | Check if Neo is online |

---

## 👤 Author
Developed by **Gimantha Dilshan** (Instagram: [@gimantha_d](https://instagram.com/gimantha_d))
