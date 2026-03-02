import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import { createObjectCsvWriter } from 'csv-writer';

const app = express();
const PORT = 3000;

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize Database
const db = new Database('catalogue.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    prod_num TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    h TEXT,
    w TEXT,
    b TEXT,
    d TEXT,
    base TEXT,
    dimensions TEXT,
    photo_filename TEXT,
    source_page TEXT,
    vendor TEXT,
    price TEXT
  )
`);

// Initialize CSV Writer
const csvWriter = createObjectCsvWriter({
  path: 'products.csv',
  header: [
    { id: 'prod_num', title: 'prod_num' },
    { id: 'name', title: 'name' },
    { id: 'type', title: 'type' },
    { id: 'h', title: 'h' },
    { id: 'w', title: 'w' },
    { id: 'b', title: 'b' },
    { id: 'd', title: 'd' },
    { id: 'base', title: 'base' },
    { id: 'dimensions', title: 'dimensions' },
    { id: 'photo_filename', title: 'photo_filename' },
    { id: 'source_page', title: 'source_page' },
    { id: 'vendor', title: 'vendor' },
    { id: 'price', title: 'price' }
  ],
  append: true
});

// Create extracted directory if it doesn't exist
const extractedDir = path.join(process.cwd(), 'extracted');
if (!fs.existsSync(extractedDir)) {
  fs.mkdirSync(extractedDir, { recursive: true });
}

// Serve extracted images
app.use('/extracted', express.static(extractedDir));
app.use(express.json());

// API to get all products
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Helper to recursively read all files in a directory
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// API to trigger processing of the pots directory
app.post('/api/process', async (req, res) => {
  const potsDir = path.join(process.cwd(), 'pots');
  
  if (!fs.existsSync(potsDir)) {
    return res.status(400).json({ error: 'Directory "pots" does not exist in the root folder.' });
  }

  const files = getAllFiles(potsDir);
  if (files.length === 0) {
    return res.status(400).json({ error: 'No images found in "pots" directory.' });
  }

  res.json({ message: `Started processing ${files.length} images.`, total: files.length });

  // Process in background
  (async () => {
    for (const filePath of files) {
      try {
        console.log(`Processing ${filePath}...`);
        const fileData = fs.readFileSync(filePath);
        const base64Data = fileData.toString('base64');
        const mimeType = 'image/' + path.extname(filePath).slice(1).replace('jpg', 'jpeg');
        const category = path.basename(path.dirname(filePath)); // e.g., planters, fountains
        const sourcePage = path.basename(filePath);

        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              }
            },
            "Find all the individual products in this image. For each product, extract its unit number (prod_num), name, and dimensions from the text associated with it. Parse the dimensions into individual values: h (height), w (width), b (base), d (depth/diameter) if available. Also provide the bounding box for the product itself (excluding the text below it) in the format [ymin, xmin, ymax, xmax] where values are integers between 0 and 1000."
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  prod_num: { type: Type.STRING, description: "Product unit number (e.g., #201, 201)" },
                  name: { type: Type.STRING, description: "Product name" },
                  dimensions: { type: Type.STRING, description: "Full dimension string" },
                  h: { type: Type.STRING, description: "Height value with unit" },
                  w: { type: Type.STRING, description: "Width value with unit" },
                  b: { type: Type.STRING, description: "Base value with unit" },
                  d: { type: Type.STRING, description: "Depth/Diameter value with unit" },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "Bounding box [ymin, xmin, ymax, xmax] normalized to 0-1000"
                  }
                },
                required: ["prod_num", "name", "dimensions", "box_2d"]
              }
            }
          }
        });

        const jsonStr = response.text || "[]";
        const extractedProducts = JSON.parse(jsonStr);

        const imageMetadata = await sharp(filePath).metadata();
        const imgWidth = imageMetadata.width || 1000;
        const imgHeight = imageMetadata.height || 1000;

        for (const p of extractedProducts) {
          // Clean prod_num
          const cleanProdNum = p.prod_num.replace(/[^a-zA-Z0-9-]/g, '');
          if (!cleanProdNum) continue;

          const photoFilename = `${cleanProdNum}.png`;
          const outputPath = path.join(extractedDir, photoFilename);

          // Crop image
          const [ymin, xmin, ymax, xmax] = p.box_2d;
          const left = Math.floor((xmin / 1000) * imgWidth);
          const top = Math.floor((ymin / 1000) * imgHeight);
          const width = Math.floor(((xmax - xmin) / 1000) * imgWidth);
          const height = Math.floor(((ymax - ymin) / 1000) * imgHeight);

          // Ensure valid crop dimensions
          if (width > 0 && height > 0 && left >= 0 && top >= 0 && (left + width) <= imgWidth && (top + height) <= imgHeight) {
            await sharp(filePath)
              .extract({ left, top, width, height })
              .toFile(outputPath);
          } else {
            console.warn(`Invalid crop dimensions for ${cleanProdNum}:`, { left, top, width, height, imgWidth, imgHeight });
            continue; // Skip if crop is invalid
          }

          const productData = {
            prod_num: cleanProdNum,
            name: p.name,
            type: category,
            h: p.h || '',
            w: p.w || '',
            b: p.b || '',
            d: p.d || '',
            base: '', // Not extracted explicitly, can be mapped if needed
            dimensions: p.dimensions,
            photo_filename: photoFilename,
            source_page: sourcePage,
            vendor: 'Giannini',
            price: ''
          };

          // Insert into DB
          const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO products (prod_num, name, type, h, w, b, d, base, dimensions, photo_filename, source_page, vendor, price)
            VALUES (@prod_num, @name, @type, @h, @w, @b, @d, @base, @dimensions, @photo_filename, @source_page, @vendor, @price)
          `);
          insertStmt.run(productData);

          // Write to CSV
          await csvWriter.writeRecords([productData]);
        }
        console.log(`Successfully processed ${filePath}`);
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
      }
    }
    console.log('Finished processing all images.');
  })();
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
