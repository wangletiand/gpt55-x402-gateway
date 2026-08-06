export class ResponseTooLargeError extends Error {}
export class PaymentTransportError extends Error {}

export function asPaymentTransportError(error) {
  if (error instanceof PaymentTransportError) return error;
  if (error instanceof TypeError || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return new PaymentTransportError('Payment transport failed; settlement status is unknown.', { cause: error });
  }
  return error;
}

export function isIndeterminatePaymentError(error) {
  return error instanceof PaymentTransportError || error instanceof ResponseTooLargeError;
}

export function isSettlementOutcomeUnknown({ paymentAttempted, settled }) {
  return paymentAttempted === true && settled !== true;
}

export async function readBoundedResponseBody(response, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Response byte limit must be a positive safe integer.');
  }
  if (!response.body) return '';

  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      throw new ResponseTooLargeError(`Payment response exceeded ${maxBytes} bytes.`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
