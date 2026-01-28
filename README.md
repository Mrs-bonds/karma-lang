# Karma (v1.0.0)

A calm, opinionated markup language that compiles `.karma` files into HTML.

## Install
npm install

## Build one page
node karma-compiler.js test.karma --pro

## Build output
This writes `test.html` next to your `.karma` file.

## Layouts (Pro)
Put layouts in `layouts/` (example: `layouts/main.html`)
Use in a page:
<PAGE TITLE="Hello" LAYOUT="main" BRAND="Karma" TAGLINE="Calm pages. Clear minds.">
