import { defineEventHandler } from 'h3'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler((_event) => {
  try {
    const filePath = resolve(process.cwd(), 'server', 'data', 'gastos.json')
    const data = readFileSync(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    console.error('Error reading gastos data:', error)
    throw error
  }
})
