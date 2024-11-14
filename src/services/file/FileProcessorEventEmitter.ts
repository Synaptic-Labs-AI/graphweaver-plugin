// src/services/file/FileProcessorEventEmitter.ts

import { EventEmitter } from 'events';
import { ProcessingEvent } from '../../types/ProcessingTypes';

export class FileProcessorEventEmitter extends EventEmitter {
    constructor() {
        super();
    }

    emitProgress(data: any) {
        this.emit('progress', data);
    }

    emitComplete(data: any) {
        this.emit('complete', data);
    }

    emitStart(data: any) {
        this.emit('start', data);
    }

    // Add other specialized emitters if needed
}
