dl_unpack/zip=unzip -q -n -d $(2) $(1)
dl_unpack/tar=tar -xf $(1) -C $(2)
#we're expecting archives, so a gz here is likely a tar.gz 
dl_unpack/gz=tar -xzf $(1) -C $(2)

define DownloadMethod/sw_builds
	$(call wrap_mirror,$(1),$(2), \
		echo "Checking out files from the morse_sw_builds repository..."; \
		mkdir -p $(TMP_DIR)/dl && \
		cd $(TMP_DIR)/dl && \
		rm -rf $(SUBDIR) && \
		[ \! -d $(SUBDIR) ] && \
		GIT_LFS_SKIP_SMUDGE=1 git clone --depth=1 --branch=$(VERSION) $(URL) $(SUBDIR) && \
		(cd $(SUBDIR) && git cat-file --filters HEAD:6108/linux/$(ARCHIVE) > $(TMP_DIR)/dl/$(ARCHIVE)) && \
		export TAR_TIMESTAMP=`cd $(SUBDIR) && git log -1 --format='@%ct'` && \
		rm -rf $(SUBDIR) && \
		mkdir -p $(SUBDIR) && \
		$(call dl_unpack/$(call ext, $(TMP_DIR)/dl/$(ARCHIVE)),$(TMP_DIR)/dl/$(ARCHIVE),$(TMP_DIR)/dl/$(SUBDIR)) && \
		(cd $(SUBDIR); $(if $(call ext,$(basename $(ARCHIVE))),subd=$(basename $(basename $(ARCHIVE))),subd=$(basename $(ARCHIVE)));\
			if [ -d $$$$subd ]; then \
				mv $$$$subd/* . && rm -rf $$$$subd; \
			fi \
		) && \
		echo "Packing checkout..." && \
		$(call dl_tar_pack,$(TMP_DIR)/dl/$(FILE),$(SUBDIR)) && \
		mv $(TMP_DIR)/dl/$(FILE) $(DL_DIR)/ && \
		rm -rf $(SUBDIR); \
	)
endef