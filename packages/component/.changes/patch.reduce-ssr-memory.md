Reduce server rendering memory use by assembling HTML and attributes with fewer temporary strings, encoding HTML in batches, and keeping hydration props serialized until they are sent. Request abort listeners are removed when rendering finishes, fails, or is canceled.

Skip generated module preloads when the document head already includes an authored preload for the same URL with matching fetch settings. Authored links and their attributes are preserved.
