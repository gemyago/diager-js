.PHONY: dist lint

dist:
	$(MAKE) -C packages/core dist

lint:
	$(MAKE) -C packages/core lint

test:
	$(MAKE) -C packages/core test
