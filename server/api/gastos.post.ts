import fs from 'node:fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const filePath = resolve(process.cwd(), 'server', 'data', 'gastos.json')
    const body = await readBody(event)
    if (!Array.isArray(body)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Solicitud inválida: el cuerpo debe ser un array de gastos'
      })
    }

    await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf8')
    return { success: true, message: 'Gastos guardados correctamente' }
  } catch (error) {
    console.error('Error al guardar gastos.json:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error interno del servidor al guardar gastos'
    })
  }
})
