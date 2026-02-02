import { defineEventHandler } from 'h3'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler(() => {
  try {
    const filePath = resolve(process.cwd(), 'server', 'data', 'bonificacionesPersonales.json')
    const data = readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading personal bonuses data:', error)
    return []
  }
})
