/**
 * Lightweight QR Code SVG generator helper for PIX payments.
 */

// Simple QR Matrix generator for standard URLs/text
export function generatePixPayload(key: string, amount: number, merchantName: string = 'IZYFOOD', city: string = 'BRASIL'): string {
  const cleanKey = key.trim();
  const amtStr = amount.toFixed(2);
  
  // Format standard BR CODE / PIX EMV QRCPS Payload
  const payloadFormat = '000201';
  const merchantAccountInfo = `26${String(14 + cleanKey.length).padStart(2, '0')}0014br.gov.bcb.pix01${String(cleanKey.length).padStart(2, '0')}${cleanKey}`;
  const categoryCode = '52040000';
  const currencyCode = '5303986';
  const amountField = `54${String(amtStr.length).padStart(2, '0')}${amtStr}`;
  const countryCode = '5802BR';
  const nameField = `59${String(merchantName.length).padStart(2, '0')}${merchantName}`;
  const cityField = `60${String(city.length).padStart(2, '0')}${city}`;
  const additionalData = '62070503***';

  const raw = `${payloadFormat}${merchantAccountInfo}${categoryCode}${currencyCode}${amountField}${countryCode}${nameField}${cityField}${additionalData}6304`;

  // CRC16 CCITT calculation
  let crc = 0xFFFF;
  for (let i = 0; i < raw.length; i++) {
    crc ^= raw.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
  return `${raw}${crcHex}`;
}
