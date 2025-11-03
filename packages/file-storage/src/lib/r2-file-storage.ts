import type { FileKey, FileMetadata, FileStorage, ListOptions, ListResult } from './file-storage.ts'
import type { R2Bucket, R2GetOptions, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions } from '@cloudflare/workers-types'

export class R2FileStorage implements FileStorage {
    #r2: R2Bucket

    constructor(r2: R2Bucket) {
        this.#r2 = r2
        console.log('package r2', this.#r2)
    }

    async get(key: string, options?: R2GetOptions): Promise<File | null> {
        console.log('options', options);
       
        let object = await this.#r2.get(key, options) as R2ObjectBody;
        console.log('object', object)

        if (object == null ) {
            return null
        }

        //this is not correct lol
        if (!('body' in object) || !object.body) {
            throw new Error('Etag Matches')
        }

        let fileArray = await object.arrayBuffer()
        // console.log('fileArray', fileArray)
        console.log('object.key', object.key)
        console.log('object.httpMetadata?.contentType', object.httpMetadata?.contentType)
        console.log('object.uploaded.getTime()', object.uploaded.getTime())

        return new File([fileArray], object.key, {
            type: object.httpMetadata?.contentType,
            lastModified: object.uploaded.getTime()
        }) as File
    }

    async put(key: string, file: File, options?: R2PutOptions): Promise<File> {
        let fileArray = await file.arrayBuffer()
        await this.#r2.put(key, fileArray, {
            httpMetadata: {
                contentType: file.type
            },
            customMetadata: {
                lastModified: file.lastModified.toString(),
                name: file.name,
                size: file.size.toString()
            },
            ...options
        })

        return new File([fileArray], file.name, {
            type: file.type,
            lastModified: file.lastModified
        }) as File
    }

    //struggling with this only returning undefined but says it would return void
    async remove(key: string): Promise<void> {
        let object = await this.#r2.delete(key)
        console.log('object', object)

        if (object === undefined) {
           return;
        } else {
            throw new Error('File not found')
        }
    }

    async list<T extends ListOptions>(options?: T): Promise<ListResult<T>> {
        let cursor: string | undefined;
        let objects = await this.#r2.list(options) as R2Objects;
      if (objects.truncated) {
            cursor = objects.cursor;
        } else {
            cursor = undefined
        }
        

        return {
            cursor: cursor,
            files: objects.objects.map(objects => {
                return { key: objects.key } as T extends { includeMetadata: true } ? FileMetadata : FileKey
            })
        };
    }

    /* This is what i assume is the correct way to handle the has method, returns metadata only or null if not found*/
    async has(key: string): Promise<boolean> {
        let object = await this.#r2.head(key) as R2Object | null
        if (object == null) {
            return false
        }
        return true
    }

   async set(key: string, file: File, options?: R2PutOptions): Promise<void>  {
        let fileArray = await file.arrayBuffer()
        await this.#r2.put(key, fileArray, {
            httpMetadata: {
                contentType: file.type
            },
            customMetadata: {
                lastModified: file.lastModified.toString(),
                name: file.name,
                size: file.size.toString()
            },
            ...options
        })
        return;
    }
 
   
}
