# 🎨 RFP to Slide Generator - Pixis GenAI Assignment

An intelligent system that transforms RFP documents into professional presentation slides using AI, with brand voice consistency and confidentiality controls.

---

## ✨ Features

### 1. **Document Ingestion Pipeline**
- Upload RFP documents (PDF format)
- Upload brand-style guidelines (PDF format)
- Automatic text extraction and processing
- Structured content storage in Weaviate vector database

### 2. **LLM Orchestration**
- GPT-4 powered slide generation
- RAG (Retrieval-Augmented Generation) for content extraction
- Intelligent summarization and content structuring
- Contextual understanding of RFP requirements

### 3. **Slide Layout Engine**
- **Page Hierarchy**: Executive summary → Key points → Details
- **Headline Styles**: Clear, impactful titles for each slide
- **Content Types**:
  - **Bullets**: For lists and key points
  - **Text**: For narrative content
  - **Charts**: For data visualization (structured format)
- **Layout Variations**: Title slides, bullet slides, two-column, charts

### 4. **Brand Voice & Safeguards**
- Brand guideline integration (colors, typography, voice/tone)
- Consistent brand voice throughout slides
- Automatic CONFIDENTIAL disclaimer on first slide
- Hallucination control through strict RFP content adherence

### 5. **Interactive Chat Interface**
- Upload RFP and brand guide documents
- Configure number of slides (3-15)
- Real-time slide generation
- Visual slide preview
- Download generated slides as JSON

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- OpenAI API key (GPT-4 access)
- Weaviate instance (cloud or local)

### Backend Setup
```bash
cd RAG-pdf-search-BE

# Install dependencies
npm install

# Configure environment variables
# Create .env file with:
OPENAI_API_KEY=your_openai_api_key
WEAVIATE_HOST=your_weaviate_host
WEAVIATE_API_KEY=your_weaviate_api_key
PORT=5000

# Start the server
node src/rfp-slides.js
```

### Frontend Setup
```bash
cd RAG-pdf-search-FE

# Install dependencies
npm install

# Start the development server
npm start
```

The application will open at `http://localhost:3000`

---

## 📖 Usage Guide

### Step 1: Upload Documents
1. Click the upload section
2. Select document type:
   - **RFP Document**: Your request for proposal
   - **Brand Guide**: Your brand style guidelines (optional)
3. Upload PDF file
4. Repeat for multiple documents

### Step 2: Configure Generation
1. Select an RFP document from the dropdown
2. (Optional) Select a brand guide for styling
3. Choose number of slides (3-15) using the slider

### Step 3: Generate Slides
1. Click "Generate Slides" button
2. Wait for AI processing (usually 10-30 seconds)
3. View generated slides in the preview panel
4. Download as JSON for further processing

### Step 4: Review & Export
- Each slide shows:
  - Slide number and title
  - Content type badge
  - Main content (bullets/text/chart data)
  - Presenter notes
- Download button exports full slide deck as JSON
- JSON can be converted to PPT/PDF using external tools

---

## 🏗️ Technical Architecture

### Backend (`rfp-slides.js`)
```
┌─────────────────────────────────────────┐
│           Document Upload               │
│  (PDF parsing, text extraction)         │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│        Weaviate Vector Store            │
│  • RFPDocument: RFP content             │
│  • BrandGuide: Brand guidelines         │
│  • SlideGeneration: Generation history  │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      GPT-4 Slide Generation             │
│  • System prompt with brand guidelines  │
│  • Content structuring logic            │
│  • Layout decision engine               │
│  • JSON slide format output             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│         Slide Output (JSON)             │
│  Array of slides with:                  │
│  - title, content, type, layout, notes  │
└─────────────────────────────────────────┘
```

### Frontend (`RFPSlideGenerator.jsx`)
- **React** with modern hooks (useState, useEffect, useRef)
- **Tailwind CSS** for responsive, modern UI
- **Lucide Icons** for visual elements
- **Real-time preview** of generated slides
- **Download functionality** for JSON export

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/check` | GET | Health check |
| `/upload` | POST | Upload RFP or brand guide |
| `/generate-slides` | POST | Generate slides from RFP |
| `/files` | GET | List all uploaded documents |
| `/slide-history` | GET | View slide generation history |

### Example API Calls

#### Upload RFP
```bash
curl -X POST http://localhost:5000/upload \
  -F "pdf=@sample_rfp.pdf" \
  -F "documentType=rfp"
```

#### Generate Slides
```bash
curl -X POST http://localhost:5000/generate-slides \
  -H "Content-Type: application/json" \
  -d '{
    "rfpFilename": "sample_rfp.pdf",
    "brandGuideFilename": "brand_guide.pdf",
    "slideCount": 5
  }'
```

---

## 🎯 Slide Structure

Each generated slide follows this JSON format:

```json
{
  "slideNumber": 1,
  "title": "Comprehensive RFP Response",
  "contentType": "bullets|text|chart",
  "content": [
    "Key point 1",
    "Key point 2"
  ],
  "layout": "title|bullets|twoColumn|chart",
  "notes": "Presenter notes for this slide"
}
```

### Content Types:
- **bullets**: Array of bullet points
- **text**: Plain text string
- **chart**: Object with chart type and data

### Layouts:
- **title**: Title slide with centered text
- **bullets**: Bulleted list layout
- **twoColumn**: Two-column layout
- **chart**: Chart/visualization layout

---

## 🎨 Brand Guidelines Integration

When a brand guide is provided, the system:
1. Extracts brand information (name, colors, typography, voice)
2. Includes guidelines in GPT-4 system prompt
3. Ensures consistent voice/tone across all slides
4. Respects brand personality and style

Example extracted guidelines:
```
Brand: Acme Corporation
Voice: Professional and innovative
Colors: Blue (#0066CC), White (#FFFFFF)
Typography: Helvetica, Arial fallback
```

---

## 🔒 Confidentiality & Safety

- First slide automatically includes CONFIDENTIAL disclaimer
- No external data leakage - content stays within system
- RFP content strictly used for slide generation only
- Hallucination control through RAG approach
- GPT-4 instructed to only use provided RFP content

---

## 📦 Output Formats

### Current: JSON
- Structured, machine-readable format
- Easy to parse and convert
- Includes all slide metadata

### Future Enhancements:
- **PowerPoint (PPTX)**: Direct .pptx file generation
- **Google Slides**: Google Slides API integration
- **PDF**: Rendered slide deck as PDF
- **Markdown**: Simple text format

---

## 🧪 Testing

### Sample Test Flow:
1. Upload `sample_rfp.pdf` (RFP document)
2. Upload `brand_style.pdf` (brand guidelines)
3. Generate 5 slides
4. Verify slide structure and content
5. Download JSON output
6. (Optional) Screen capture video (≤ 5 min) demo

---

## 🚧 Known Limitations

1. **PDF-only**: Currently supports PDF format only (no DOCX yet)
2. **Text-based**: Works best with text-based PDFs (not scanned images)
3. **JSON output**: Requires conversion for PPT/PDF formats
4. **Chart data**: Chart slides include structured data but not actual visualizations

---

## 🔮 Future Enhancements

- [ ] DOCX file support
- [ ] Direct PowerPoint generation
- [ ] Google Slides API integration
- [ ] OCR for scanned PDFs
- [ ] Template customization
- [ ] Multi-language support
- [ ] Batch processing
- [ ] Advanced chart generation
- [ ] Collaboration features

---

## 📝 Assignment Compliance

### Required Scope Checklist:
✅ **Document-ingestion pipeline**: PDF parsing, text extraction  
✅ **LLM orchestration**: GPT-4, RAG, summarization  
✅ **Slide-layout engine**: Page hierarchy, headline styles, content types  
✅ **Brand voice safeguards**: Guideline integration, confidentiality  
✅ **Interactive chat interface**: Upload, configure, generate, preview  
✅ **5+ auto-generated slides**: Configurable (3-15 slides)  
✅ **Screen-capture video ready**: Demo workflow in <5 min

### Additional Guidelines:
✅ Open-source UI: React + Tailwind CSS  
✅ Design fidelity: Professional layout and styling  
✅ Flexible styling: Brand guide or reference deck support  

---

## 🤝 Contributing

This is an assignment project for Pixis GenAI Engineer position.

For questions or clarifications, please reach out.

---

## 📄 License

This project is created as part of a technical assignment.

---

**Built with ❤️ for Pixis GenAI Assignment**  
*December 2025*
