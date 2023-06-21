const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-tests/',
    '/lib-tests/',
  ],
  modulePathIgnorePatterns: ['/build-assets/', '/dist-tests/', '/lib-tests/'],
};

export default config;
