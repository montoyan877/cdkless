module.exports = {
  preset: "ts-jest",
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        isolatedModules: false
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
  globals: {
    'ts-jest': {
      // Eliminar isolatedModules para permitir que ts-jest transforme correctamente los imports
      // isolatedModules: true,
    },
  },
  // Evitar transformar módulos específicos
  transformIgnorePatterns: [
    '/node_modules/(?!aws-cdk-lib)'
  ],
  // Configurar aliases de módulos si es necesario
  moduleNameMapper: {
    '^aws-cdk-lib/(.*)$': '<rootDir>/node_modules/aws-cdk-lib/$1'
  }
}; 