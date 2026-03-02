# Catalogue Image Extractor

An AI-powered tool for extracting individual product images and metadata from catalogue pages. Point it at a directory of catalogue scans, and it automatically detects each product, crops it out, and builds a searchable product database.

## How it works

1. Place catalogue page images inside the `pots/` directory, organised into subdirectories by product type (e.g. `pots/planters/`, `pots/fountains/`)
2. Start the app and click **Start Batch Processing**
3. Each image is sent to Gemini, which identifies every product on the page and returns its name, product number, dimensions, and bounding box
4. The server crops each product using the bounding box, saves it to `extracted/`, and writes the metadata to a SQLite database and `products.csv`
5. Browse the results in the **Catalogue Browser** tab with search and type filtering

## Output

| File | Contents |
|---|---|
| `extracted/<prod_num>.png` | Cropped product image |
| `products.csv` | All products as a flat CSV |
| `catalogue.db` | SQLite database with full product records |

### Product fields

`prod_num`, `name`, `type` (from subdirectory name), `h`, `w`, `b`, `d`, `dimensions`, `photo_filename`, `source_page`, `vendor`, `price`

## Setup

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and add your Gemini API key:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and set `GEMINI_API_KEY` to your key from [Google AI Studio](https://aistudio.google.com/apikey).

3. Create your `pots/` directory and add catalogue images:
   ```
   pots/
   ├── planters/
   │   ├── page1.jpg
   │   └── page2.jpg
   └── fountains/
       └── page1.jpg
   ```

4. Run the app:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Express, TypeScript (`tsx`)
- **AI:** Google Gemini (vision + structured JSON output)
- **Image processing:** Sharp
- **Database:** better-sqlite3
- **Export:** csv-writer
