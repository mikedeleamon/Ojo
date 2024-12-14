module.exports = {
    preset: 'react',
    testEnvironment: 'jsdom', // Jest needs a browser-like environment for React
    moduleNameMapper: {
        '^react-router-dom$': require.resolve('react-router-dom'), // Ensure Jest resolves react-router-dom correctly
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest', // If using TypeScript, use ts-jest for transformation
    },
    moduleDirectories: ['node_modules', 'src'],
};
