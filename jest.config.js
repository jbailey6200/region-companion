// jest.config.js
export default {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setupTests.js"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  testMatch: ["<rootDir>/tests/**/*.test.{js,jsx}"],
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest",
  },
};