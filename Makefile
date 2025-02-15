.PHONY: dist lint

packages = $(patsubst packages/%,%,$(wildcard packages/*))

.PHONY: FORCE

packages/%/dist: FORCE
	@echo "Building: $*"
	@$(MAKE) -C packages/$* dist
dist: $(patsubst %,packages/%/dist,$(packages))

packages/%/lint: FORCE
	@echo "Linting: $*"
	@$(MAKE) -C packages/$* lint
lint: $(patsubst %,packages/%/lint,$(packages))

packages/%/test: FORCE
	@echo "Running tests: $*"
	@$(MAKE) -C packages/$* test
test: $(patsubst %,packages/%/test,$(packages))
