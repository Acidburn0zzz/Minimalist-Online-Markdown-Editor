var editor,
	$window = $(window),
	$document = $(document);

$document.ready(function() {
	"use strict";

	var buttonsContainers = $(".buttons-container");
	
	editor = {
		
		// Editor variables
		body: $(document.body),
		fitHeightElements: $(".full-height"),
		wrappersMargin: $("#left-column > .wrapper:first").outerHeight(true) - $("#left-column > .wrapper:first").height(),
		previewMarkdownConverter: window.markdownit({ html: true }).use(window.markdownitMapLines),
		cleanHtmlMarkdownConverter: window.markdownit({ html: true }),
		columns: $("#left-column, #right-column"),
		markdown: "",
		markdownSource: $("#markdown"),
		markdownHtml: document.getElementById("html"),
		markdownPreview: $("#preview"),
		markdownTargets: $("#html, #preview"),
		buttonsContainers: buttonsContainers,
		markdownTargetsTriggers: buttonsContainers.find(".switch"),
		topPanels: $("#top_panels_container .top_panel"),
		topPanelsTriggers: buttonsContainers.find(".toppanel"),
		quickReferencePreText: $("#quick-reference pre"),
		featuresTriggers: buttonsContainers.find(".feature"),
		wordCountContainers: $(".word-count"),
		isSyncScrollDisabled: true,
		isFullscreen: false,
		activePanel: null,
		
		// Initiate editor
		init: function() {
			this.onloadEffect(0);
			this.initBindings();
			this.fitHeight();
			this.restoreState(function() {
				editor.onInput();
				editor.onloadEffect(1);
			});
		},

		// Handle events on several DOM elements
		initBindings: function() {
			$window.on("resize", function() {
				editor.fitHeight();
			});

			this.markdownSource.on("keydown", function(e) {
				if (!e.ctrlKey && e.keyCode == keyCode.TAB) editor.handleTabKeyPress(e);
			});

			if (doesSupportInputEvent) {
				this.markdownSource.on("input", function() {
					editor.onInput(true);
				});
			} else {
				var onInput = function() {
					editor.onInput(true);
				};

				this.markdownSource.on({
					"keyup change": onInput,

					"cut paste drop": function() {
						setTimeout(onInput, 0);
					}
				});
			}

			this.markdownTargetsTriggers.on("click", function(e) {
				e.preventDefault();
				editor.switchToPanel($(this).data("switchto"));
			});

			this.topPanelsTriggers.on("click", function(e) {
				e.preventDefault();
				editor.toggleTopPanel($("#"+ $(this).data("toppanel")));
			});

			this.topPanels.children(".close").on("click", function(e) {
				e.preventDefault();
				editor.closeTopPanels();
			});

			this.quickReferencePreText.on("click", function() {
				editor.addToMarkdownSource($(this).text());
			});

			this.featuresTriggers.on("click", function(e) {
				e.preventDefault();
				var t = $(this);
				editor.toggleFeature(t.data("feature"), t.data());
			});
		},

		onInput: function(isUserInput) {
			var updatedMarkdown = this.markdownSource.val();

			if (updatedMarkdown != this.markdown) {
				this.markdown = updatedMarkdown;
				this.onChange(isUserInput);
			}
		},

		onChange: function(isAfterUserInput) {
			this.save("markdown", this.markdown);
			this.convertMarkdown(isAfterUserInput);
		},

		// Resize some elements to make the editor fit inside the window
		fitHeight: function() {
			var newHeight = $window.height() - this.wrappersMargin;
			this.fitHeightElements.each(function() {
				var t = $(this);
				if (t.closest("#left-column").length) {
					var thisNewHeight = newHeight - $("#top_panels_container").outerHeight();
				} else {
					var thisNewHeight = newHeight;
				}
				t.css({ height: thisNewHeight +"px" });
			});
		},

		// Save a key/value pair in the app storage (either Markdown text or enabled features)
		save: function(key, value) {
			app.save(key, value);
		},

		// Restore the editor's state
		restoreState: function(c) {
			app.restoreState(function(restoredItems) {
				if (restoredItems.markdown) editor.markdownSource.val(restoredItems.markdown);
				if (restoredItems.isSyncScrollDisabled != "y") editor.toggleFeature("sync-scroll");
				if (restoredItems.isFullscreen == "y") editor.toggleFeature("fullscreen");
				editor.switchToPanel(restoredItems.activePanel || "preview");

				c();
			});
		},

		// Convert Markdown to HTML and update active panel
		convertMarkdown: function(isAfterUserInput) {
			var html;

			if (this.activePanel != "preview" && this.activePanel != "html") return;

			if (this.activePanel == "preview") {
				html = this.previewMarkdownConverter.render(this.markdown);
				app.updateMarkdownPreview(html, isAfterUserInput);

				this.triggerEditorUpdatedEvent(isAfterUserInput);
			} else if (this.activePanel == "html") {
				html = this.cleanHtmlMarkdownConverter.render(this.markdown);
				this.markdownHtml.value = html;
			}
		},

		triggerEditorUpdatedEvent: function(isAfterUserInput) {
			editor.markdownPreview.trigger("updated.editor", [{
				syncScrollReference: isAfterUserInput? editor.syncScroll.ref.CARET : editor.syncScroll.ref.SCROLLBAR
			}]);
		},

		// Programmatically add Markdown text to the textarea
		// pos = { start: Number, end: Number }
		addToMarkdownSource: function(markdown, pos) {
			var newMarkdownSourceVal, newMarkdownSourceLength,
				markdownSourceVal = this.markdown;

			// Add text at the end of the input
			if (typeof pos == "undefined") {
				if (markdownSourceVal.length) markdown = "\n\n"+ markdown;

				newMarkdownSourceVal = markdownSourceVal + markdown;
				newMarkdownSourceLength = newMarkdownSourceVal.length;

				this.updateMarkdownSource(newMarkdownSourceVal, { start: newMarkdownSourceLength, end: newMarkdownSourceLength });
			// Add text at a given position
			} else {
				newMarkdownSourceVal =
					markdownSourceVal.substring(0, pos.start) +
					markdown +
					markdownSourceVal.substring(pos.end);

				pos.start = pos.end = pos.start + markdown.length;

				this.updateMarkdownSource(newMarkdownSourceVal, pos);
			}
		},

		// Programmatically update the Markdown textarea with new Markdown text
		updateMarkdownSource: function(markdown, caretPos, isUserInput) {
			this.markdownSource.val(markdown);
			if (caretPos) this.setMarkdownSourceCaretPos(caretPos);

			this.onInput(isUserInput);
		},

		// Doesn't work in IE<9
		getMarkdownSourceCaretPos: function() {
			var markdownSourceEl = this.markdownSource[0];

			if (typeof markdownSourceEl.selectionStart != "number" || typeof markdownSourceEl.selectionEnd != "number") return;
			
			return {
				start: markdownSourceEl.selectionStart,
				end: markdownSourceEl.selectionEnd
			};
		},

		// Doesn't work in IE<9
		setMarkdownSourceCaretPos: function(pos) {
			var markdownSourceEl = this.markdownSource[0];

			if (!("setSelectionRange" in markdownSourceEl)) return;

			// Force auto-scroll to the caret's position by blurring then focusing the input (doesn't work in IE)
			// When calling setSelectionRange, Firefox will properly scroll to the range into view. Chrome doesn't,
			// but we can hack our way around by blurring and focusing the input to force auto-scroll to the caret's
			// position. Neither the proper behavior nor the hack work in IE. Not a big issue, and it'll be solved
			// when implementing "perfect" sync-scrolling.
			markdownSourceEl.blur();
			markdownSourceEl.setSelectionRange(pos.start, pos.end);
			markdownSourceEl.focus();
		},

		// Return the line where the character at position pos is situated in the source
		getMarkdownSourceLineFromPos: function(pos) {
			var sourceBeforePos = this.markdown.slice(0, pos.start);
			return sourceBeforePos.split("\n").length - 1;
		},

		getMarkdownSourceLineCount: function(pos) {
			return this.markdown.split("\n").length;
		},

		// Switch between editor panels
		switchToPanel: function(which) {
			var target = $("#"+ which),
				targetTrigger = this.markdownTargetsTriggers.filter("[data-switchto="+ which +"]");

			if (!this.isFullscreen || which != "markdown") this.markdownTargets.not(target).hide();
			target.show();

			this.markdownTargetsTriggers.not(targetTrigger).removeClass("active");
			targetTrigger.addClass("active");

			if (which != "markdown") this.featuresTriggers.filter("[data-feature=fullscreen][data-tofocus]").last().data("tofocus", which);

			if (this.isFullscreen) {
				var columnToShow = (which == "markdown")? this.markdownSource.closest(this.columns) : this.markdownPreview.closest(this.columns);

				columnToShow.show();
				this.columns.not(columnToShow).hide();
			}

			this.activePanel = which;
			this.save("activePanel", this.activePanel);

			// If one of the two panels displaying the Markdown output becomes visible, convert Markdown for that panel
			if (this.activePanel == "preview" || this.activePanel == "html") this.convertMarkdown();
		},

		// Toggle a top panel's visibility
		toggleTopPanel: function(panel) {
			if (panel.is(":visible")) this.closeTopPanels();
				else this.openTopPanel(panel);
		},

		// Open a top panel
		openTopPanel: function(panel) {
			var panelTrigger = this.topPanelsTriggers.filter("[data-toppanel="+ panel.attr("id") +"]");
			panel.show();
			panelTrigger.addClass("active");
			this.topPanels.not(panel).hide();
			this.topPanelsTriggers.not(panelTrigger).removeClass("active");
			this.fitHeight();
			$document.off("keydown.toppanel").on("keydown.toppanel", function(e) {
				if (e.keyCode == keyCode.ESCAPE) editor.closeTopPanels();
			});
		},

		// Close all top panels
		closeTopPanels: function() {
			this.topPanels.hide();
			this.topPanelsTriggers.removeClass("active");
			this.fitHeight();
			$document.off("keydown.toppanel");
		},

		// Toggle editor feature
		toggleFeature: function(which, featureData) {
			var featureTrigger = this.featuresTriggers.filter("[data-feature="+ which +"]");
			switch (which) {
				case "sync-scroll":
					this.toggleSyncScroll();
					break;
				case "fullscreen":
					this.toggleFullscreen(featureData);
					break;
			}
			featureTrigger.toggleClass("active");
		},

		toggleSyncScroll: (function() {
			var isMdSourceKeyPressed,

				refSyncScroll = function(e, arg) {
					var reference;

					if (e && e.type == "updated") reference = arg.syncScrollReference;
						else reference = isMdSourceKeyPressed? editor.syncScroll.ref.CARET : editor.syncScroll.ref.SCROLLBAR;

					editor.syncScroll(reference);
				};

			return function() {
				if (this.isSyncScrollDisabled) {
					this.markdownPreview.on("updated.editor", refSyncScroll);
					this.markdownSource.on({
						"scroll.syncScroll": refSyncScroll,
						"keydown.syncScroll": function() { isMdSourceKeyPressed = true }
					});
					this.body.on("keyup.syncScroll", function() { isMdSourceKeyPressed = false });

					refSyncScroll();
					isMdSourceKeyPressed = false;
				} else {
					this.markdownPreview.off("updated.editor");
					this.markdownSource.off(".syncScroll");
					this.body.off("keyup.syncScroll");
				}

				this.isSyncScrollDisabled = !this.isSyncScrollDisabled;
				this.save("isSyncScrollDisabled", this.isSyncScrollDisabled? "y" : "n");
			};
		})(),

		toggleFullscreen: function(featureData) {
			var toFocus = featureData && featureData.tofocus;
			this.isFullscreen = !this.isFullscreen;
			this.body.toggleClass("fullscreen");
			if (toFocus) this.switchToPanel(toFocus);
			// Exit fullscreen
			if (!this.isFullscreen) {
				this.columns.show(); // Make sure all columns are visible when exiting fullscreen
				var activeMarkdownTargetsTriggersSwichtoValue = this.markdownTargetsTriggers.filter(".active").first().data("switchto");
				// Force one of the right panel's elements to be active if not already when exiting fullscreen
				if (activeMarkdownTargetsTriggersSwichtoValue == "markdown") {
					this.switchToPanel("preview");
				}
				// Emit update when exiting fullscreen and "preview" is already active since it changes width
				if (activeMarkdownTargetsTriggersSwichtoValue == "preview") {
					this.triggerEditorUpdatedEvent();
				}
				$document.off("keydown.fullscreen");
			// Enter fullscreen
			} else {
				this.closeTopPanels();
				$document.on("keydown.fullscreen", function(e) {
					if (e.keyCode == keyCode.ESCAPE) editor.featuresTriggers.filter("[data-feature=fullscreen]").last().trigger("click");
				});
			}
			this.save("isFullscreen", this.isFullscreen? "y" : "n");
			this.body.trigger("fullscreen.editor", [this.isFullscreen]);
		},

		// Synchronize the scroll position of the preview panel with the source
		syncScroll: (function() {
			var syncScroll = function(reference) {
				var markdownPreview = this.markdownPreview[0],
					markdownSource = this.markdownSource[0];

				if (reference == editor.syncScroll.ref.SCROLLBAR) {
					markdownPreview.scrollTop = (markdownPreview.scrollHeight - markdownPreview.offsetHeight) * markdownSource.scrollTop / (markdownSource.scrollHeight  - markdownSource.offsetHeight);
				} else {
					app.scrollMarkdownPreviewCaretIntoView();
				}
			};

			syncScroll.ref = {
				CARET: 0,
				SCROLLBAR: 1
			};

			return syncScroll;
		})(),

		// Subtle fade-in effect
		onloadEffect: function(step) {
			switch (step) {
				case 0:
					this.body.fadeTo(0, 0);
					break;
				case 1:
					this.body.fadeTo(1000, 1);
					break;
			}
		},

		// Insert a tab character when the tab key is pressed (instead of focusing the next form element)
		handleTabKeyPress: function(e) {
			var caretPos = this.getMarkdownSourceCaretPos();
			if (!caretPos) return;

			e.preventDefault();

			this.addToMarkdownSource("\t", caretPos);
		},

		// Count the words in the Markdown output and update the word count in the corresponding
		// .word-count elements in the editor
		updateWordCount: function(text) {
			var wordCount = "";

			if (text.length) {
				wordCount = text.trim().replace(/\s+/gi, " ").split(" ").length;
				wordCount = wordCount.toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, ",") +" words"; // Format number (add commas and unit)
			}

			this.wordCountContainers.text(wordCount);
		}
		
	};
	
});
