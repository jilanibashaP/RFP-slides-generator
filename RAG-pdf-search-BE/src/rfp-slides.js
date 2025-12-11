const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const weaviate = require('weaviate-ts-client').default;
const express = require('express');
const multer = require('multer');
const PptxGenJS = require('pptxgenjs');

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

// Generate PowerPoint from slides
app.post('/generate-pptx', async (req, res) => {
  try {
    const { slides, rfpFilename, brandColors } = req.body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ error: 'Slides array is required' });
    }

    // Create presentation
    const pptx = new PptxGenJS();
    
    // Set presentation properties
    pptx.author = 'RFP Slide Generator';
    pptx.company = 'Pixis AI';
    pptx.title = `RFP Response - ${rfpFilename || 'Presentation'}`;
    pptx.subject = 'RFP Response Presentation';
    
    // Default colors (can be overridden by brand colors)
    const primaryColor = brandColors?.primary || '4F46E5'; // Indigo
    const secondaryColor = brandColors?.secondary || '7C3AED'; // Purple
    const accentColor = brandColors?.accent || '3B82F6'; // Blue
    const textColor = '1E293B'; // Slate

    // Generate slides
    slides.forEach((slideData, index) => {
      const slide = pptx.addSlide();
      
      // Add slide number (bottom right)
      slide.addText(`${slideData.slideNumber || index + 1}`, {
        x: 9.2,
        y: 5.2,
        w: 0.6,
        h: 0.3,
        fontSize: 10,
        color: '94A3B8',
        align: 'right'
      });

      // Slide layouts based on type
      switch (slideData.layout) {
        case 'title':
          // Title slide with centered content
          slide.background = { color: primaryColor };
          
          // Add CONFIDENTIAL disclaimer
          if (index === 0) {
            slide.addText('CONFIDENTIAL', {
              x: 0.5,
              y: 0.3,
              w: 9,
              h: 0.5,
              fontSize: 14,
              bold: true,
              color: 'FFFFFF',
              align: 'center'
            });
          }
          
          // Main title
          slide.addText(slideData.title, {
            x: 1,
            y: 2.2,
            w: 8,
            h: 1.2,
            fontSize: 44,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle'
          });
          
          // Subtitle or content
          if (slideData.content) {
            const contentText = Array.isArray(slideData.content) 
              ? slideData.content.join(' • ') 
              : slideData.content;
            
            slide.addText(contentText, {
              x: 1.5,
              y: 3.8,
              w: 7,
              h: 1,
              fontSize: 18,
              color: 'E2E8F0',
              align: 'center'
            });
          }
          
          // Add decorative line
          slide.addShape(pptx.ShapeType.rect, {
            x: 3.5,
            y: 3.5,
            w: 3,
            h: 0.05,
            fill: { color: accentColor }
          });
          break;

        case 'bullets':
          // Header with gradient
          slide.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: 10,
            h: 1.2,
            fill: { type: 'solid', color: primaryColor }
          });
          
          // Title
          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.6,
            fontSize: 32,
            bold: true,
            color: 'FFFFFF'
          });
          
          // Bullet points
          if (Array.isArray(slideData.content)) {
            slideData.content.forEach((bullet, idx) => {
              slide.addText(bullet, {
                x: 0.8,
                y: 1.8 + (idx * 0.6),
                w: 8.4,
                h: 0.5,
                fontSize: 16,
                color: textColor,
                bullet: { type: 'number', code: '•' }
              });
            });
          }
          break;

        case 'twoColumn':
          // Header
          slide.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: 10,
            h: 1,
            fill: { color: primaryColor }
          });
          
          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.25,
            w: 9,
            h: 0.5,
            fontSize: 28,
            bold: true,
            color: 'FFFFFF'
          });
          
          // Two columns
          const midContent = Array.isArray(slideData.content) 
            ? Math.ceil(slideData.content.length / 2) 
            : 1;
          
          const leftContent = Array.isArray(slideData.content) 
            ? slideData.content.slice(0, midContent) 
            : [slideData.content];
          
          const rightContent = Array.isArray(slideData.content) 
            ? slideData.content.slice(midContent) 
            : [];
          
          // Left column
          leftContent.forEach((item, idx) => {
            slide.addText(item, {
              x: 0.5,
              y: 1.5 + (idx * 0.5),
              w: 4.5,
              h: 0.4,
              fontSize: 14,
              color: textColor,
              bullet: true
            });
          });
          
          // Right column
          rightContent.forEach((item, idx) => {
            slide.addText(item, {
              x: 5.2,
              y: 1.5 + (idx * 0.5),
              w: 4.5,
              h: 0.4,
              fontSize: 14,
              color: textColor,
              bullet: true
            });
          });
          break;

        case 'chart':
          // Header
          slide.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: 10,
            h: 1,
            fill: { color: primaryColor }
          });
          
          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.25,
            w: 9,
            h: 0.5,
            fontSize: 28,
            bold: true,
            color: 'FFFFFF'
          });
          
          // Chart placeholder text
          slide.addText('📊 Chart Data Visualization', {
            x: 2,
            y: 2.5,
            w: 6,
            h: 1,
            fontSize: 24,
            color: textColor,
            align: 'center'
          });
          
          // Display chart data as text
          if (slideData.content && typeof slideData.content === 'object') {
            const chartInfo = JSON.stringify(slideData.content, null, 2);
            slide.addText(chartInfo, {
              x: 1,
              y: 3.8,
              w: 8,
              h: 1.5,
              fontSize: 12,
              color: '64748B',
              fontFace: 'Courier New',
              align: 'left'
            });
          }
          break;

        default:
          // Default text layout
          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 0.8,
            fontSize: 32,
            bold: true,
            color: primaryColor
          });
          
          const contentText = Array.isArray(slideData.content) 
            ? slideData.content.join('\n\n') 
            : slideData.content;
          
          slide.addText(contentText, {
            x: 0.7,
            y: 1.8,
            w: 8.6,
            h: 3.5,
            fontSize: 16,
            color: textColor
          });
      }
      
      // Add presenter notes
      if (slideData.notes) {
        slide.addNotes(slideData.notes);
      }
    });

    // Generate file
    const outputPath = path.join(__dirname, 'uploads', `presentation_${Date.now()}.pptx`);
    await pptx.writeFile({ fileName: outputPath });

    // Send file
    res.download(outputPath, `${rfpFilename || 'presentation'}.pptx`, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up file after sending
      fs.unlink(outputPath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
    });

  } catch (error) {
    console.error('Error generating PowerPoint:', error);
    res.status(500).json({
      error: 'Failed to generate PowerPoint',
      details: error.message
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
      console.log(`📊 Generate PowerPoint: POST /generate-pptx`);
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
