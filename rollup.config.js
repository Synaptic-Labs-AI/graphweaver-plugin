// rollup.config.js

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import path from 'path';

export default {
    input: 'src/main.ts', // Update this path if your main file is different
    output: {
        dir: 'dist',
        format: 'cjs',
        sourcemap: 'inline',
        exports: 'default',
    },
    external: ['obsidian'], // Mark 'obsidian' as external to exclude it from the bundle
    plugins: [
        resolve(),
        commonjs(),
        typescript({
            tsconfig: './tsconfig.json',
        }),
        postcss({
            inject: false, // Prevent automatic injection into <head>
            extract: 'styles.css',
            modules: false, // Disable CSS modules
            minimize: true,
            use: ['sass']
        }),
    ],
};
