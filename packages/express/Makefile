.PHONY: lint test clean FORCE

eslint=../../node_modules/.bin/eslint
tsc=../../node_modules/.bin/tsc
jest=../../node_modules/.bin/jest

clean:
	rm -r -f dist

dist: clean FORCE
	$(tsc)
	rm -rf dist/scripts dist/__tests__

lint:
	$(eslint) . --ext .js,.jsx,.ts,.tsx

test:
	$(jest) --coverage
