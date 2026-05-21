import type { ParseResult } from '@/lib/types'
import { parseChaseConsumerPDF } from './amazonChasePDF'

export async function parseChaseSapphirePDF(file: File): Promise<ParseResult> {
  return parseChaseConsumerPDF(file, 'Chase Sapphire Preferred')
}
