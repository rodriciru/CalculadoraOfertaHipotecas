import fs from 'fs/promises';
import path from 'path';

export default defineEventHandler(async (event) => {
  const hipotecasFilePath = path.join(process.cwd(), 'public', 'hipotecas.json');
  try {
    const body = await readBody(event);
    await fs.writeFile(hipotecasFilePath, JSON.stringify(body, null, 2), 'utf-8');
    return { success: true, message: 'Hipotecas saved successfully' };
  } catch (error) {
    console.error('Error writing to hipotecas.json:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Error writing to hipotecas.json',
    });
  }
});
