export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: ['source/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};

