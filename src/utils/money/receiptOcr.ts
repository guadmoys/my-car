import { parseReceiptText, type ParsedReceipt } from './receiptText'

/**
 * Recognises a receipt photo on-device with Tesseract. The library is loaded
 * lazily, and its Russian language data is fetched on first use, so this needs
 * a network connection once; everything else in the app stays offline-first.
 */
export async function recognizeReceipt(dataUrl: string): Promise<ParsedReceipt> {
  const { recognize } = await import('tesseract.js')
  const { data } = await recognize(dataUrl, 'rus+eng')
  return parseReceiptText(data.text)
}
