import fs from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  const DATA_FILE = join(process.cwd(), 'server/data/bonificaciones.json')
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    console.error('Error al leer bonificaciones.json:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error interno del servidor al cargar bonificaciones'
    })
  }
})
