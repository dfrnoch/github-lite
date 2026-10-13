import { defineConfig } from 'oxlint';
import solidV2 from 'eslint-plugin-solid/configs/v2';

export default defineConfig({
  jsPlugins: ['eslint-plugin-solid'],
  ignorePatterns: ['**/*.gen.*', 'dist'],
  settings: solidV2.settings,
  rules: {
    ...solidV2.rules,
    // `let el!: T` + `ref={el}` is assigned by the Solid compiler.
    'no-unassigned-vars': 'off',
  },
});
