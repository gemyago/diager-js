.PHONY: FORCE lint test

eslint=../../node_modules/.bin/eslint
tsc=../../node_modules/.bin/tsc
jest=../../node_modules/.bin/jest

clean_dist:
	rm -r -f dist

dist/%: FORCE
	$(tsc) -p tsconfig.$*.json

dist: clean_dist dist/esm dist/cjs FORCE

lint:
	$(eslint) . --ext .js,.jsx,.ts,.tsx

test:
	$(jest) --coverage
