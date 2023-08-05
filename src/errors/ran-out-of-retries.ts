import { RetrySettingsData } from '../retry-settings';
import { RetryableError } from './retryable-error';

export class RanOutOfRetries extends RetryableError {
  constructor(
    retryConfig: RetrySettingsData,
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
