import { defineEventHandler } from 'h3'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler((_event) => {
  try {
    const filePath = resolve(process.cwd(), 'server', 'data', 'bonificaciones.json')
    const data = readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading bonificaciones data:', error)
    return []
  }
})
