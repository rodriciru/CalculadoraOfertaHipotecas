import fs from 'node:fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async (event) => {
  const filePath = resolve(process.cwd(), 'server', 'data', 'bonificaciones.json')
  try {
    const body = await readBody(event)
    console.log(body)

    if (!Array.isArray(body)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Solicitud inválida: el cuerpo debe ser un array de bonificaciones'
      })
    }

    await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf8')
    return { success: true, message: 'Bonificaciones guardadas correctamente' }
  } catch (error) {
    console.error('Error al guardar bonificaciones.json:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error interno del servidor al guardar bonificaciones'
    })
  }
})
