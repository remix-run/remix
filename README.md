# multipart-web-stream

This is a streaming multipart parser for JavaScript with no dependencies.

## Installation

```sh
$ npm install multipart-web-stream
```

## Usage

```typescript
import { parseMultipartFormData, MultipartParseError } from 'multipart-web-stream';

function handleMultipartRequest(request: Request): void {
  try {
    // The parser `yield`s each part as a MultipartPart as it becomes available.
    for await (let part of parseMultipartFormData(request)) {
      console.log(part.name);
      console.log(part.filename);
      console.log(part.contentType);
      console.log(new TextDecoder().decode(part.content));
    }
  } catch (error) {
    if (error instanceof MultipartParseError) {
      console.error('Failed to parse multipart/form-data:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }
}
```
