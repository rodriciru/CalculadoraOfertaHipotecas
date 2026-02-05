import fs from 'node:fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const filePath = resolve(process.cwd(), 'server', 'data', 'hipotecas.json')
    const body = await readBody(event)
    // Validar que el cuerpo es un array de gastos
    if (!Array.isArray(body)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Solicitud inválida: el cuerpo debe ser un array de hipotecas'
      })
    }

    // Asegurar que cada hipoteca tenga un ID único y persistente
    const processedBody = body.map((hipoteca, index) => {
      if (!hipoteca.id) {
        // Si no tiene ID, se le asigna uno nuevo y único.
        hipoteca.id = `${Date.now()}-${index}`
      }
      return hipoteca
    })

    await fs.writeFile(filePath, JSON.stringify(processedBody, null, 2), 'utf8')
    return { success: true, message: 'Hipotecas guardadas correctamente' }
  } catch (error) {
    console.error('Error al guardar hipotecas.json:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Error interno del servidor al guardar hipotecas'
    })
  }
})
