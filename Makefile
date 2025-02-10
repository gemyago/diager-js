.PHONY: dist

# Call make for each package
dist:
	$(MAKE) -C packages/core dist
