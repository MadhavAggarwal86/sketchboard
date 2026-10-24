const Canvas = require('../models/canvas');

// Live element changes are broadcast immediately but written to MongoDB in
// batches, so a stream of brush updates does not turn into one write per move.
const FLUSH_DELAY_MS = 500;

// canvasId -> Map<elementId, element | null> (null means deleted)
const pendingByCanvas = new Map();
const flushTimers = new Map();
const writeQueues = new Map();

const elementKey = (id) => String(id);

const applyChanges = (elements, changes) => {
    const nextElements = [...elements];
    changes.forEach((element, key) => {
        const index = nextElements.findIndex((item) => elementKey(item?.id) === key);
        if (element === null) {
            if (index >= 0) nextElements.splice(index, 1);
        } else if (index >= 0) {
            nextElements[index] = element;
        } else {
            nextElements.push(element);
        }
    });
    return nextElements;
};

const scheduleFlush = (canvasId) => {
    if (flushTimers.has(canvasId)) return;
    flushTimers.set(canvasId, setTimeout(() => {
        flushTimers.delete(canvasId);
        flushCanvas(canvasId);
    }, FLUSH_DELAY_MS));
};

const queueElementChanges = (canvasId, upserts, deletes) => {
    let pending = pendingByCanvas.get(canvasId);
    if (!pending) {
        pending = new Map();
        pendingByCanvas.set(canvasId, pending);
    }
    upserts.forEach((element) => pending.set(elementKey(element.id), element));
    deletes.forEach((id) => pending.set(elementKey(id), null));
    scheduleFlush(canvasId);
};

const flushCanvas = (canvasId) => {
    const previousWrite = writeQueues.get(canvasId) || Promise.resolve();
    const write = previousWrite.then(async () => {
        const pending = pendingByCanvas.get(canvasId);
        if (!pending?.size) return;
        const snapshot = new Map(pending);

        const canvas = await Canvas.findById(canvasId).select('elements').lean();
        if (!canvas) {
            discardCanvasChanges(canvasId);
            return;
        }
        await Canvas.updateOne(
            { _id: canvasId },
            { $set: { elements: applyChanges(canvas.elements || [], snapshot) } }
        );

        // Changes stay pending until written, so readers can always merge them in.
        snapshot.forEach((element, key) => {
            if (pending.get(key) === element) pending.delete(key);
        });
        if (!pending.size && pendingByCanvas.get(canvasId) === pending) {
            pendingByCanvas.delete(canvasId);
        }
    }).catch((error) => {
        console.error('Failed to save canvas elements:', error);
        if (pendingByCanvas.get(canvasId)?.size) scheduleFlush(canvasId);
    });

    writeQueues.set(canvasId, write);
    write.then(() => {
        if (writeQueues.get(canvasId) === write) writeQueues.delete(canvasId);
    });
    return write;
};

const waitForWrites = (canvasId) => writeQueues.get(canvasId) || Promise.resolve();

const withPendingChanges = (canvasId, elements = []) => {
    const pending = pendingByCanvas.get(canvasId.toString());
    return pending?.size ? applyChanges(elements, pending) : elements;
};

const discardCanvasChanges = (canvasId) => {
    clearTimeout(flushTimers.get(canvasId));
    flushTimers.delete(canvasId);
    pendingByCanvas.delete(canvasId);
};

const flushAllCanvases = () => Promise.all(
    [...pendingByCanvas.keys()].map((canvasId) => {
        clearTimeout(flushTimers.get(canvasId));
        flushTimers.delete(canvasId);
        return flushCanvas(canvasId);
    })
);

module.exports = {
    queueElementChanges,
    flushCanvas,
    waitForWrites,
    withPendingChanges,
    discardCanvasChanges,
    flushAllCanvases,
};
