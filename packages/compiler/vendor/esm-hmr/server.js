"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EsmHmrEngine = void 0;
const ws_1 = __importDefault(require("ws"));
class EsmHmrEngine {
    constructor(options = {}) {
        this.clients = new Set();
        this.dependencyTree = new Map();
        const wss = options.server
            ? new ws_1.default.Server({ noServer: true })
            : new ws_1.default.Server({ port: 12321 });
        if (options.server) {
            options.server.on("upgrade", (req, socket, head) => {
                // Only handle upgrades to ESM-HMR requests, ignore others.
                if (req.headers["sec-websocket-protocol"] !== "esm-hmr") {
                    return;
                }
                wss.handleUpgrade(req, socket, head, (client) => {
                    wss.emit("connection", client, req);
                });
            });
        }
        wss.on("connection", (client) => {
            this.connectClient(client);
            this.registerListener(client);
        });
    }
    registerListener(client) {
        client.on("message", (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === "hotAccept") {
                const entry = this.getEntry(message.id, true);
                entry.isHmrAccepted = true;
            }
        });
    }
    createEntry(sourceUrl) {
        const newEntry = {
            dependencies: new Set(),
            dependents: new Set(),
            needsReplacement: false,
            isHmrEnabled: false,
            isHmrAccepted: false,
        };
        this.dependencyTree.set(sourceUrl, newEntry);
        return newEntry;
    }
    getEntry(sourceUrl, createIfNotFound = false) {
        const result = this.dependencyTree.get(sourceUrl);
        if (result) {
            return result;
        }
        if (createIfNotFound) {
            return this.createEntry(sourceUrl);
        }
        return null;
    }
    setEntry(sourceUrl, imports, isHmrEnabled = false) {
        const result = this.getEntry(sourceUrl, true);
        const outdatedDependencies = new Set(result.dependencies);
        result.isHmrEnabled = isHmrEnabled;
        for (const importUrl of imports) {
            this.addRelationship(sourceUrl, importUrl);
            outdatedDependencies.delete(importUrl);
        }
        for (const importUrl of outdatedDependencies) {
            this.removeRelationship(sourceUrl, importUrl);
        }
    }
    removeRelationship(sourceUrl, importUrl) {
        let importResult = this.getEntry(importUrl);
        importResult && importResult.dependents.delete(sourceUrl);
        const sourceResult = this.getEntry(sourceUrl);
        sourceResult && sourceResult.dependencies.delete(importUrl);
    }
    addRelationship(sourceUrl, importUrl) {
        if (importUrl !== sourceUrl) {
            let importResult = this.getEntry(importUrl, true);
            importResult.dependents.add(sourceUrl);
            const sourceResult = this.getEntry(sourceUrl, true);
            sourceResult.dependencies.add(importUrl);
        }
    }
    markEntryForReplacement(entry, state) {
        entry.needsReplacement = state;
    }
    broadcastMessage(data) {
        this.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify(data));
            }
            else {
                this.disconnectClient(client);
            }
        });
    }
    connectClient(client) {
        this.clients.add(client);
    }
    disconnectClient(client) {
        client.terminate();
        this.clients.delete(client);
    }
    disconnectAllClients() {
        for (const client of this.clients) {
            this.disconnectClient(client);
        }
    }
}
exports.EsmHmrEngine = EsmHmrEngine;
