Fix `createFsSessionStorage` corrupting a session file when overlapping requests save the same session. A corrupted file made every later request for that session throw. Saves now write a temporary file and rename it over the session file, so reads always see a complete session. Replaced session files keep their existing permissions.

On Windows, where replacing a file can fail while another program such as a virus scanner has it open, a save retries for about a second before failing.
