import { defineEventHandler, readBody } from 'h3'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const filePath = resolve(process.cwd(), 'server', 'data', 'bonificacionesPersonalesAdiciones.json')
    writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Error writing personal bonuses data:', error)
    return { success: false, error: 'Failed to save data' }
  }
})
