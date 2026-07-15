export type ServerHmrEvent = {
    acceptedUrl?: string;
    filePath: string;
    timestamp: number;
    type: 'update';
    url: string;
} | {
    filePath?: string;
    reason?: string;
    timestamp: number;
    type: 'restart';
    url?: string;
};
export interface ServerHmrEventSource {
    subscribe(listener: (event: ServerHmrEvent) => void): () => void;
}
type ServerHmrEventListener = (event: ServerHmrEvent) => void;
declare class ServerHmrEvents implements ServerHmrEventSource {
    #private;
    subscribe(listener: ServerHmrEventListener): () => void;
    emit(event: ServerHmrEvent): void;
}
export declare const serverHmrEvents: ServerHmrEvents;
export declare function emitServerHmrEvent(event: ServerHmrEvent): void;
export declare function emitServerHmrUpdate(event: Extract<ServerHmrEvent, {
    type: 'update';
}>): void;
export {};
//# sourceMappingURL=events.d.ts.map