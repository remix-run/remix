import type { FileKey, FileMetadata, FileStorage, ListOptions, ListResult } from './file-storage.ts'
import type { R2Bucket, R2GetOptions, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions } from '@cloudflare/workers-types'

export class R2FileStorage implements FileStorage {
    #r2: R2Bucket

    constructor(r2: R2Bucket) {
        this.#r2 = r2
    }

    async get(key: string, options?: R2GetOptions): Promise<File | null> {
        let object = await this.#r2.get(key, options) as R2ObjectBody;

        if (object == null ) {
            return null
        }

        let fileArray = await object.arrayBuffer()

        return new File([fileArray], object.customMetadata?.name ?? object.key, {
            type: object.httpMetadata?.contentType,
            lastModified: parseInt(object.customMetadata?.lastModified ?? object.uploaded.getTime().toString())
        }) as File
    }

    async put(key: string, file: File, options?: R2PutOptions): Promise<File> {
        let fileArray = await file.arrayBuffer()
        let object = await this.#r2.put(key, fileArray, {
            httpMetadata: {
                contentType: file.type
            },
            customMetadata: {
                lastModified: file.lastModified.toString(),
                name: file.name,
                size: file.size.toString()
            },
            ...options
        }) as R2Object

        return new File([fileArray], object.key, {
            type: object.httpMetadata?.contentType,
            lastModified: object.uploaded.getTime()
        }) as File
    }

    async remove(key: string): Promise<void> {
        await this.#r2.delete(key)
    }

    //The cloudflare R2ListOptions type is missing the include to check for presence of metadata or not. So did not include type
    async list<T extends ListOptions>(options?: T): Promise<ListResult<T>> {
        let r2Options: any = {
          limit: options?.limit,
          prefix: options?.prefix,
          cursor: options?.cursor,
        }
      
        if (options?.includeMetadata) {
          r2Options.include = ['httpMetadata', 'customMetadata']
        }
      
        let objects = await this.#r2.list(r2Options) as R2Objects
      
        return {
          cursor: objects.truncated ? objects.cursor : undefined,
          files: objects.objects.map(obj => {
            if (options?.includeMetadata) {
              return {
                key: obj.key,
                lastModified: obj.uploaded.getTime(),
                name: obj.customMetadata?.name ?? obj.key,
                size: obj.size,
                type: obj.httpMetadata?.contentType ?? '',
              } as FileMetadata
            }
            return { key: obj.key } as FileKey
          }) as any,
        }
    }

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
