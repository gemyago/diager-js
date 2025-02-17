.PHONY: dist lint

# We could collect packages automatically,
# but we need to keep the order, so hardcoding for now.
# Below snippet can be used to collect automatically:
# $(patsubst packages/%,%,$(wildcard packages/*))
# But some magic would be required to keep the order.
packages = core express axios

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

packages/%/clean: FORCE
	@echo "Cleaning: $*"
	@$(MAKE) -C packages/$* clean
clean: $(patsubst %,packages/%/clean,$(packages))
