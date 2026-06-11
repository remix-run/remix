Handle aborted request bodies in `node-fetch-server` so stream and lazy body reads reject instead of staying pending after an upload is cut short.
