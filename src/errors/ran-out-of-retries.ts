import { RetryableError } from './retryable-error';

export class RanOutOfRetries extends RetryableError {
  constructor(
    retryConfig: { times: number; intervalMillis: number; backoffFactor: number },
    attempts: Array<{
      returnedValue?: unknown;
      exceptionThrown?: unknown;
    }>,
    id?: string
  ) {
    super('Ran out of retries while executing operation', {
      retryConfig,
      attempts,
      id,
    });
  }
}
