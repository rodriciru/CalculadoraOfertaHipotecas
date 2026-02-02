import fs from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (_event) => {
  const DATA_FILE = join(process.cwd(), 'server/data/gastos.json')
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Si el archivo no existe, devolver un array vacío
      return []
    }
    console.error('Error al leer gastos.json:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error interno del servidor al cargar gastos'
    })
  }
})
