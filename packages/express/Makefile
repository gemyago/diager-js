.PHONY: dist

eslint=../../node_modules/.bin/eslint
tsc=../../node_modules/.bin/tsc
jest=../../node_modules/.bin/jest

clean_dist:
	rm -r -f dist

dist: clean_dist
	$(tsc)
	rm -rf dist/scripts dist/__tests__

lint:
	$(eslint) . --ext .js,.jsx,.ts,.tsx

test:
	$(jest) --coverage
