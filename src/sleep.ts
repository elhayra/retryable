export function sleep(timeoutMS: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMS);
  });
}
