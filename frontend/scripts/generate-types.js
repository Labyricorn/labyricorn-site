import openapiTS, { astToString } from 'openapi-typescript';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const OPENAPI_URL = `${API_BASE_URL}/openapi.json`;
const OUTPUT_PATH = path.join(__dirname, '../src/types/api.ts');

async function generateTypes() {
  try {
    console.log(`Fetching OpenAPI schema from ${OPENAPI_URL}...`);
    
    // openapi-typescript v7 returns an AST that needs to be converted to string
    const ast = await openapiTS(new URL(OPENAPI_URL), {
      exportType: true,
    });

    // Convert AST to string
    const output = astToString(ast);

    // Ensure the types directory exists
    const typesDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }

    // Write the generated types to file
    fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
    
    console.log(`✓ Types generated successfully at ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Error generating types:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

generateTypes();
