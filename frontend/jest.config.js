/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          types: ["jest", "@testing-library/jest-dom"]
        }
      }
    ]
  },
  // import.meta.env is not available under CommonJS, so tests use a plain config stub.
  moduleNameMapper: {
    "^.*/config$": "<rootDir>/src/__mocks__/config.ts",
    "\\.css$": "<rootDir>/src/__mocks__/style.ts"
  }
};
