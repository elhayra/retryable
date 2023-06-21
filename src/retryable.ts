import { RanOutOfRetries } from './errors';
import { RetrySettings } from './retry-settings';
import { sleep } from './sleep';

export class Retryable<CallbackReturnType> {
  public retry: RetrySettings<CallbackReturnType>;

  constructor(private callback: (...args: any[]) => Promise<CallbackReturnType>) {
    this.retry = new RetrySettings();
  }

  public async run(): Promise<CallbackReturnType> {
    let intervalMillis = this.retry._intervalMillis;
    const sleepWithBackoff = async () => {
      await sleep(intervalMillis);
      intervalMillis *= this.retry._backoffFactor;
    };

    let returnedValue: CallbackReturnType | undefined;
    let exceptionThrown: unknown;

    for (let t = this.retry._times; t >= 0; t--) {
      try {
        returnedValue = await this.callback();
        const isValueQualifyForRetry = this.retry._returnedValues.includes(returnedValue);
        if (isValueQualifyForRetry) {
          sleepWithBackoff();
          continue;
        }
        return returnedValue;
      } catch (e: any) {
        exceptionThrown = e;
        const isErrorQualifyForRetry = this.retry._errors.find(
          (err) => err.constructor === e?.constructor
        );
        if (isErrorQualifyForRetry) {
          sleepWithBackoff();
          continue;
        }
        throw e;
      }
    }

    throw new RanOutOfRetries(
      {
        times: this.retry._times,
        intervalMillis: this.retry._intervalMillis,
        backoffFactor: this.retry._backoffFactor,
      },
      {
        lastErrorThrown: exceptionThrown,
        lastReturnedValue: returnedValue,
      }
    );
  }
}
