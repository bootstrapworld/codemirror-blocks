# file to simplify running tsc and js-beautify
DIR=src/languages/pyret
TSC_FLAGS=--target es6 --jsx react
JS_B_FLAGS=--indent-size 2 --replace --brace-style preserve-inline

all:	${DIR}/PyretParser.js ${DIR}/ast.js

${DIR}/PyretParser.js:	${DIR}/PyretParser.ts
	# -tsc $< ${TSC_FLAGS}
	js-beautify ${JS_B_FLAGS} $@

${DIR}/ast.js:	${DIR}/ast.tsx
	# -tsc $< ${TSC_FLAGS}
	js-beautify ${JS_B_FLAGS} $@