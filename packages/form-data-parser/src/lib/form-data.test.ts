import * as assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import type { FileUploadHandler } from './form-data.ts';
import { parseFormData } from './form-data.ts';

describe('parseFormData', () => {
  it('parses a application/x-www-form-urlencoded request', async () => {
    let request = new Request('http://localhost:8080', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'text=Hello%2C%20World!',
    });

    let formData = await parseFormData(request);

    assert.equal(formData.get('text'), 'Hello, World!');
  });

  it('parses a multipart/form-data request', async () => {
    let request = new Request('http://localhost:8080', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="text"',
        '',
        'Hello, World!',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    });

    let formData = await parseFormData(request);

    assert.equal(formData.get('text'), 'Hello, World!');

    let file = formData.get('file');
    assert.ok(file instanceof File);
    assert.equal(file.name, 'example.txt');
    assert.equal(file.type, 'text/plain');
    assert.equal(await file.text(), 'This is an example file.');
  });

  it('calls the file upload handler for each file part', async () => {
    let request = new Request('http://localhost:8080', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file1"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file2"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is another example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    });

    let fileUploadHandler = mock.fn<FileUploadHandler>();

    await parseFormData(request, fileUploadHandler);

    assert.equal(fileUploadHandler.mock.calls.length, 2);
  });

  it('allows returning `null` from the upload handler', async () => {
    let request = new Request('http://localhost:8080', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    });

    let formData = await parseFormData(request, () => null);

    assert.equal(formData.get('file'), null);
  });

  it('allows returning strings from the upload handler', async () => {
    let request = new Request('http://localhost:8080', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    });

    let formData = await parseFormData(request, (upload) => upload.text());

    assert.equal(formData.get('file'), 'This is an example file.');
  });

  it('allows returning files from the upload handler', async () => {
    let request = new Request('http://localhost:8080', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
      },
      body: [
        '------WebKitFormBoundary7MA4YWxkTrZu0gW',
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        'Content-Type: text/plain',
        '',
        'This is an example file.',
        '------WebKitFormBoundary7MA4YWxkTrZu0gW--',
      ].join('\r\n'),
    });

    let formData = await parseFormData(request, async (upload) => {
      return new File([await upload.text()], 'example.txt', { type: 'text/plain' });
    });

    let file = formData.get('file');

    assert.ok(file instanceof File);
    assert.equal(file.name, 'example.txt');
    assert.equal(file.type, 'text/plain');
    assert.equal(await file.text(), 'This is an example file.');
  });
});
