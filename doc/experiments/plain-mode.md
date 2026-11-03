# Experiment: "plain" mode (structured editing that looks like text)

Status: idea, spike pending. Block mode already edits through the AST and rejects any change that would not leave a valid program. A "plain" look would draw the blocks with no decoration (no borders, colours, drag handles; the editor's own font) and style the inline edit box like text, keeping focus movement, screen-reader labels and keyboard commands. See issue #106.

Open questions: whether rendered nodes keep the source's line breaks and indentation; what the caret does (block mode has none between characters); free-form text in strings and comments; pointer selection across nodes.
