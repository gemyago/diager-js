.PHONY: FORCE lint test

eslint=../../node_modules/.bin/eslint
tsc=../../node_modules/.bin/tsc
jest=../../node_modules/.bin/jest

clean:
	rm -r -f dist

dist: FORCE
	$(tsc) -p tsconfig.json

lint:
	$(eslint) . --ext .js,.jsx,.ts,.tsx --max-warnings 0

test:
	@echo No tests here

publish:
	@echo No example packages
