# 🎨 RFP to Slide Generator

> **Pixis GenAI Engineer Assignment** - An intelligent system that transforms RFP documents into professional presentation slides using AI.

[![Node.js](https://img.shields.io/badge/Node.js-v14+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview

This system automatically generates professional presentation slides from Request for Proposal (RFP) documents using GPT-4 and Retrieval-Augmented Generation (RAG). It maintains brand consistency, ensures confidentiality, and creates structured slide decks with intelligent layout decisions.

### ✨ Key Features

- 📄 **Document Ingestion**: Upload RFP (PDF) and brand guidelines
- 🤖 **LLM Orchestration**: GPT-4 powered content generation with RAG
- 🎨 **Smart Layout Engine**: Auto-detects best layout for each slide
- 🔒 **Brand Voice & Safety**: Maintains consistency, adds confidentiality disclaimers
- 💻 **Interactive UI**: Modern React interface with real-time preview
- 📊 **Multiple Content Types**: Bullets, text, and charts

---

## 🚀 Quick Start

### Prerequisites

- Node.js v14+ 
- OpenAI API key (GPT-4 access)
- Weaviate instance (cloud or local)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd RAG-pdf-search
```

2. **Backend Setup**
```bash
cd RAG-pdf-search-BE
npm install

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
WEAVIATE_HOST=your_weaviate_host
WEAVIATE_API_KEY=your_weaviate_api_key
PORT=5000
EOF

# Start server
node src/rfp-slides.js
```

3. **Frontend Setup** (in new terminal)
```bash
cd RAG-pdf-search-FE
npm install
npm run dev
```

4. **Access the app** at `http://localhost:3000` (or 3001 if 3000 is busy)

---

## 📖 Usage

### 1️⃣ Upload Documents
- Click **Upload RFP Document** → Select your PDF
- Optionally upload **Brand Guide** for consistent styling

### 2️⃣ Configure Generation
- Select RFP document from dropdown
- Choose brand guide (optional)
- Set number of slides (3-15)

### 3️⃣ Generate & Preview
- Click **Generate Slides**
- View slides in real-time preview panel
- Download as JSON

### 4️⃣ Export
- Download JSON structure
- Convert to PPT/PDF using external tools (planned feature)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React + Vite)         │
│  • RFPSlideGenerator.jsx                │
│  • Upload, Configure, Preview UI        │
└──────────────┬──────────────────────────┘
               │ HTTP API
               ▼
┌─────────────────────────────────────────┐
│      Backend (Express.js + Node)        │
│  • rfp-slides.js                        │
│  • Document upload & parsing            │
│  • Slide generation orchestration       │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌────────────┐
│   Weaviate   │  │  OpenAI    │
│  Vector DB   │  │   GPT-4    │
│  • RFP docs  │  │  • Content │
│  • Brand     │  │  • Layout  │
│  • History   │  │  • Summary │
└──────────────┘  └────────────┘
```

---

## 📁 Project Structure

```
RAG-pdf-search/
├── README.md                    # This file
├── PIXIS_README.md             # Detailed technical docs
├── .gitignore
│
├── RAG-pdf-search-BE/          # Backend
│   ├── package.json
│   ├── .env                    # API keys (not in git)
│   └── src/
│       └── rfp-slides.js       # Main server
│
└── RAG-pdf-search-FE/          # Frontend
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── index.jsx           # Entry point
        ├── index.css           # Tailwind styles
        └── RFPSlideGenerator.jsx  # Main component
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/check` | GET | Health check |
| `/upload` | POST | Upload RFP/brand guide PDF |
| `/generate-slides` | POST | Generate slides from RFP |
| `/files` | GET | List uploaded documents |
| `/slide-history` | GET | View generation history |

**Example:**
```bash
# Upload RFP
curl -X POST http://localhost:5000/upload \
  -F "pdf=@rfp.pdf" \
  -F "documentType=rfp"

# Generate slides
curl -X POST http://localhost:5000/generate-slides \
  -H "Content-Type: application/json" \
  -d '{"rfpFilename":"rfp.pdf","slideCount":5}'
```

---

## 🎯 Slide Output Format

Each slide is structured as:

```json
{
  "slideNumber": 1,
  "title": "Executive Summary",
  "contentType": "bullets",
  "content": ["Point 1", "Point 2", "Point 3"],
  "layout": "bullets",
  "notes": "Presenter notes for this slide"
}
```

**Content Types:** `bullets`, `text`, `chart`  
**Layouts:** `title`, `bullets`, `twoColumn`, `chart`

---

## 🔒 Security & Confidentiality

- ✅ First slide includes CONFIDENTIAL disclaimer
- ✅ No external data leakage
- ✅ RFP content used only for slide generation
- ✅ Brand guidelines respected
- ✅ Hallucination control via RAG

---

## 🛠️ Technologies

**Backend:**
- Node.js + Express.js
- Weaviate (vector database)
- OpenAI GPT-4 (LLM)
- pdf-parse (PDF extraction)
- Multer (file uploads)

**Frontend:**
- React 18
- Vite (build tool)
- Tailwind CSS (styling)
- Lucide Icons

---

## 📋 Assignment Requirements ✅

### Required Scope
- ✅ Document-ingestion pipeline
- ✅ LLM orchestration (RAG + summarization)
- ✅ Slide-layout engine (hierarchy, headlines, content types)
- ✅ Brand voice safeguards & confidentiality
- ✅ Interactive chat interface
- ✅ 5+ auto-generated slides

### Additional Guidelines
- ✅ Open-source UI components
- ✅ Professional design fidelity
- ✅ Flexible styling support
- ✅ Screen-capture demo ready (≤5 min)

---

## 🔮 Future Enhancements

- [ ] Direct PowerPoint (.pptx) export
- [ ] Google Slides integration
- [ ] DOCX file support
- [ ] OCR for scanned PDFs
- [ ] Advanced chart rendering
- [ ] Multi-language support
- [ ] Batch processing
- [ ] Template marketplace

---

## 📝 License

This project is created as part of a technical assignment for Pixis GenAI Engineer position.

---

## 📚 Documentation

For detailed technical documentation, see [`PIXIS_README.md`](./PIXIS_README.md)

---

**Built with ❤️ for Pixis**
