const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const weaviate = require('weaviate-ts-client').default;
const express = require('express');
const multer = require('multer');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Weaviate client
const client = weaviate.client({
  scheme: 'https',
  host: process.env.WEAVIATE_HOST,
  apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});

// Initialize Express app
const app = express();
app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const USER_UPLOADS_DIR = './user_uploads';
if (!fs.existsSync(USER_UPLOADS_DIR)) {
  fs.mkdirSync(USER_UPLOADS_DIR, { recursive: true });
}

// Schemas
const rfpDocumentSchema = {
  class: 'RFPDocument',
  description: 'RFP document content for slide generation',
  vectorizer: 'none',
  properties: [
    { name: 'content', dataType: ['text'] },
    { name: 'filename', dataType: ['string'] },
    { name: 'savedFilename', dataType: ['string'] },
    { name: 'uploadDate', dataType: ['date'] },
    { name: 'filePath', dataType: ['string'] },
  ],
};

const brandGuideSchema = {
  class: 'BrandGuide',
  description: 'Brand style guidelines',
  vectorizer: 'none',
  properties: [
    { name: 'brandName', dataType: ['string'] },
    { name: 'content', dataType: ['text'] },
    { name: 'filename', dataType: ['string'] },
    { name: 'colorPalette', dataType: ['text'] },
    { name: 'typography', dataType: ['text'] },
    { name: 'voiceTone', dataType: ['text'] },
    { name: 'uploadDate', dataType: ['date'] },
  ],
};

const slideGenerationSchema = {
  class: 'SlideGeneration',
  description: 'Generated slide decks',
  vectorizer: 'none',
  properties: [
    { name: 'rfpFilename', dataType: ['string'] },
    { name: 'brandGuideFilename', dataType: ['string'] },
    { name: 'slideCount', dataType: ['int'] },
    { name: 'slides', dataType: ['text'] },
    { name: 'generatedDate', dataType: ['date'] },
    { name: 'status', dataType: ['string'] },
  ],
};

// Initialize schemas
async function initializeSchema() {
  try {
    const schema = await client.schema.getter().do();
    
    const schemas = [
      { schema: rfpDocumentSchema, name: 'RFPDocument' },
      { schema: brandGuideSchema, name: 'BrandGuide' },
      { schema: slideGenerationSchema, name: 'SlideGeneration' }
    ];

    for (const { schema: schemaObj, name } of schemas) {
      const exists = schema.classes.some(cls => cls.class === name);
      if (!exists) {
        await client.schema.classCreator().withClass(schemaObj).do();
        console.log(`✅ ${name} schema created`);
      } else {
        console.log(`ℹ️  ${name} schema exists`);
      }
    }
  } catch (error) {
    console.error('Schema initialization failed:', error);
    throw error;
  }
}

// Extract PDF text
async function extractPDFText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  return { text: data.text, numPages: data.numpages };
}

// Routes

// Health check
app.get('/check', (req, res) => {
  res.json({
    success: true,
    message: 'RFP to Slide Generator API is running',
    timestamp: new Date().toISOString()
  });
});

// Upload RFP or Brand Guide
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { documentType = 'rfp' } = req.body;
    const { text, numPages } = await extractPDFText(req.file.path);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const savedFilename = `${timestamp}_${req.file.originalname}`;
    const permanentPath = path.join(USER_UPLOADS_DIR, savedFilename);
    fs.copyFileSync(req.file.path, permanentPath);
    fs.unlinkSync(req.file.path);

    if (documentType === 'brand-guide') {
      await client.data.creator()
        .withClassName('BrandGuide')
        .withProperties({
          brandName: req.file.originalname.replace('.pdf', ''),
          content: text,
          filename: req.file.originalname,
          colorPalette: 'To be extracted',
          typography: 'Standard',
          voiceTone: 'Professional',
          uploadDate: new Date().toISOString()
        })
        .do();
      
      console.log(`✅ Brand guide stored: ${req.file.originalname}`);
    } else {
      await client.data.creator()
        .withClassName('RFPDocument')
        .withProperties({
          content: text,
          filename: req.file.originalname,
          savedFilename: savedFilename,
          uploadDate: new Date().toISOString(),
          filePath: permanentPath
        })
        .do();
      
      console.log(`✅ RFP stored: ${req.file.originalname}`);
    }

    res.json({
      success: true,
      message: `${documentType === 'brand-guide' ? 'Brand guide' : 'RFP'} uploaded successfully`,
      data: {
        filename: req.file.originalname,
        documentType,
        pages: numPages
      }
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Generate slides from RFP
app.post('/generate-slides', async (req, res) => {
  try {
    const { rfpFilename, brandGuideFilename, slideCount = 5 } = req.body;

    if (!rfpFilename) {
      return res.status(400).json({
        success: false,
        error: 'RFP filename is required'
      });
    }

    console.log(`🎨 Generating ${slideCount} slides from RFP: ${rfpFilename}`);

    // Retrieve RFP content
    const rfpResults = await client.graphql
      .get()
      .withClassName('RFPDocument')
      .withFields('content filename')
      .withWhere({
        path: ['filename'],
        operator: 'Equal',
        valueText: rfpFilename
      })
      .withLimit(1)
      .do();

    const rfpDoc = rfpResults.data.Get.RFPDocument?.[0];

    if (!rfpDoc) {
      return res.status(404).json({
        success: false,
        error: 'RFP document not found. Please upload it first.'
      });
    }

    // Retrieve brand guidelines
    let brandGuidelines = null;
    if (brandGuideFilename) {
      const brandResults = await client.graphql
        .get()
        .withClassName('BrandGuide')
        .withFields('content brandName colorPalette typography voiceTone')
        .withWhere({
          path: ['filename'],
          operator: 'Equal',
          valueText: brandGuideFilename
        })
        .withLimit(1)
        .do();

      brandGuidelines = brandResults.data.Get.BrandGuide?.[0];
    }

    // Generate slides using LLM
    const systemPrompt = `You are an expert presentation designer for RFP responses.

Create ${slideCount} professional slides from the RFP content provided.

${brandGuidelines ? `Brand Guidelines:
- Brand: ${brandGuidelines.brandName}
- Voice: ${brandGuidelines.voiceTone}
- Colors: ${brandGuidelines.colorPalette}
- Typography: ${brandGuidelines.typography}` : 'Use professional corporate styling.'}

Requirements:
1. Start with a compelling title slide
2. Include executive summary
3. Address key RFP requirements
4. Use clear hierarchy (headings, subheadings)
5. Mix content types: bullets for lists, text for narrative, charts for data
6. Keep slides concise and impactful
7. Add CONFIDENTIAL disclaimer on first slide
8. Maintain brand voice throughout

Return ONLY a valid JSON array:
[
  {
    "slideNumber": 1,
    "title": "Slide Title",
    "contentType": "bullets|text|chart",
    "content": ["Point 1", "Point 2"] or "Text" or {"chartType": "bar", "data": [...]},
    "layout": "title|bullets|twoColumn|chart",
    "notes": "Presenter notes"
  }
]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `RFP Content:\n${rfpDoc.content}\n\nGenerate ${slideCount} slides. Return ONLY valid JSON.` }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    let slides = [];
    try {
      const responseText = completion.choices[0].message.content;
      const jsonMatch = responseText.match(/\[\s*{[\s\S]*}\s*\]/);
      slides = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate valid slide structure'
      });
    }

    // Store generation record
    await client.data.creator()
      .withClassName('SlideGeneration')
      .withProperties({
        rfpFilename,
        brandGuideFilename: brandGuideFilename || 'None',
        slideCount: slides.length,
        slides: JSON.stringify(slides),
        generatedDate: new Date().toISOString(),
        status: 'completed'
      })
      .do();

    console.log(`✅ Generated ${slides.length} slides`);

    res.json({
      success: true,
      data: {
        rfpFilename,
        brandGuideFilename: brandGuideFilename || 'Default',
        slideCount: slides.length,
        slides,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Slide generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate slides',
      details: error.message
    });
  }
});

// List uploaded documents
app.get('/files', async (req, res) => {
  try {
    const rfpResults = await client.graphql
      .get()
      .withClassName('RFPDocument')
      .withFields('filename uploadDate')
      .withLimit(100)
      .do();

    const brandResults = await client.graphql
      .get()
      .withClassName('BrandGuide')
      .withFields('filename brandName uploadDate')
      .withLimit(100)
      .do();

    res.json({
      success: true,
      data: {
        rfpDocuments: rfpResults.data.Get.RFPDocument || [],
        brandGuides: brandResults.data.Get.BrandGuide || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get slide generation history
app.get('/slide-history', async (req, res) => {
  try {
    const results = await client.graphql
      .get()
      .withClassName('SlideGeneration')
      .withFields('rfpFilename brandGuideFilename slideCount generatedDate status')
      .withLimit(50)
      .do();

    res.json({
      success: true,
      data: {
        generations: results.data.Get.SlideGeneration || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
async function startServer() {
  try {
    await initializeSchema();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 RFP to Slide Generator running on port ${PORT}`);
      console.log(`📄 Upload RFP/Brand Guide: POST /upload`);
      console.log(`🎨 Generate Slides: POST /generate-slides`);
      console.log(`📁 List Files: GET /files`);
      console.log(`📊 Slide History: GET /slide-history`);
      console.log(`❤️  Health Check: GET /check`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app };
