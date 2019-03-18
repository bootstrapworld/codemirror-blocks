# file to simplify running tsc and js-beautify
DIR=src/languages/pyret
FLAGS=--target es6 --jsx react

all:	${DIR}/PyretParser.js ${DIR}/ast.js

${DIR}/PyretParser.js:	${DIR}/PyretParser.ts
	tsc ${FLAGS} $<

${DIR}/ast.js:	${DIR}/ast.tsx
	tsc ${FLAGS} $<