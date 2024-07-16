# fetch-multipart-parser

`fetch-multipart-parser` is a streaming multipart parser for JavaScript's fetch API.

## Installation

```sh
$ npm install fetch-multipart-parser
```

## Usage

```typescript
import { MultipartParseError, parseMultipartFormData } from 'fetch-multipart-parser';

function handleMultipartRequest(request: Request): void {
  try {
    // The parser `yield`s each part as a MultipartPart as it becomes available.
    for await (let part of parseMultipartFormData(request)) {
      console.log(part.name);
      console.log(part.filename);
      console.log(part.contentType);

      if (/^text\//.test(part.contentType)) {
        console.log(new TextDecoder().decode(part.content));
      } else {
        // part.content is binary data, save it to a file
      }
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
