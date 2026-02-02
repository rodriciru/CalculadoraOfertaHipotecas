import fs from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const DATA_FILE = join(process.cwd(), 'server/data/hipotecas.json')
  try {
    const body = await readBody(event)
    // Validar que el cuerpo es un array de gastos
    if (!Array.isArray(body)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Solicitud inválida: el cuerpo debe ser un array de hipotecas'
      })
    }

    await fs.writeFile(DATA_FILE, JSON.stringify(body, null, 2), 'utf8')
    return { success: true, message: 'Hipotecas guardadas correctamente' }
  } catch (error) {
    console.error('Error al guardar hipotecas.json:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error interno del servidor al guardar hipotecas'
    })
  }
})
