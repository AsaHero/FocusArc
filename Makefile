# FocusArc DB backups — pull a WAL-safe SQLite snapshot from the server.
#
# Runs `sqlite3 .backup` on the node (produces a single, consistent .db with the
# WAL merged in), then copies it here into ./.backup/ with a timestamp.

SSH_HOST   ?= root@188.245.207.173
REMOTE_DB  ?= /var/lib/rancher/k3s/storage/pvc-f7c67bcc-8192-41ec-a91d-9068770b51ee_focusarc_focusarc-data/focusarc.db
BACKUP_DIR ?= .backup
KEEP       ?= 7   # how many local backups to retain

.PHONY: backup verify-backup clean-backups

backup:
	@mkdir -p $(BACKUP_DIR)
	@ts=$$(date +%Y%m%d-%H%M%S); \
	remote_tmp="/tmp/focusarc-$$ts.db"; \
	dest="$(BACKUP_DIR)/focusarc-$$ts.db"; \
	echo ">> Creating WAL-safe backup on $(SSH_HOST)"; \
	ssh $(SSH_HOST) "sqlite3 $(REMOTE_DB) \".backup '$$remote_tmp'\"" || { echo "backup failed on server"; exit 1; }; \
	echo ">> Downloading -> $$dest"; \
	scp -q $(SSH_HOST):$$remote_tmp "$$dest"; \
	ssh $(SSH_HOST) "rm -f $$remote_tmp"; \
	echo ">> Verifying integrity"; \
	if [ "$$(sqlite3 "$$dest" 'PRAGMA integrity_check;')" != "ok" ]; then \
	  echo "integrity check FAILED, removing $$dest"; rm -f "$$dest"; exit 1; \
	fi; \
	ln -sf "$$(basename "$$dest")" "$(BACKUP_DIR)/focusarc-latest.db"; \
	echo ">> Done: $$dest"; \
	$(MAKE) --no-print-directory clean-backups

# Prune old local backups, keeping the newest $(KEEP).
clean-backups:
	@ls -1t $(BACKUP_DIR)/focusarc-2*.db 2>/dev/null | tail -n +$$(( $(KEEP) + 1 )) | while read -r f; do \
	  echo ">> Pruning $$f"; rm -f "$$f"; \
	done; true

# Sanity-check the most recent local backup.
verify-backup:
	@sqlite3 "$(BACKUP_DIR)/focusarc-latest.db" \
	  "SELECT name, open_focus_date FROM users; SELECT COUNT(*) AS sessions FROM sessions;"
