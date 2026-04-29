import antfu from '@antfu/eslint-config';

export default antfu({
  react: true,
  typescript: true,
  formatters: true,
}, {
  rules: {
    'style/semi': ['error', 'always'],
    'style/comma-dangle': ['error', 'always-multiline'],
    'react/prefer-namespace-import': 'off',
  },
});
