import { createFileResponse as sendFile } from 'remix/response/file';
import { uploadsStorage } from './utils/uploads.js';
export let uploadsAction = async ({ request, params, }) => {
    let file = await uploadsStorage.get(params.key);
    if (!file) {
        return new Response('File not found', { status: 404 });
    }
    return sendFile(file, request, {
        cacheControl: 'public, max-age=31536000',
    });
};
