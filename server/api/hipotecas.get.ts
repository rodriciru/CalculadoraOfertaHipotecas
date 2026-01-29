import fs from 'fs/promises';
import path from 'path';

export default defineEventHandler(async (event) => {
  const hipotecasFilePath = path.join(process.cwd(), 'public', 'hipotecas.json');
  try {
    const data = await fs.readFile(hipotecasFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading hipotecas.json:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Error reading hipotecas.json',
    });
  }
});
